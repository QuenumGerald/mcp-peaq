import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import dotenv from "dotenv";

import { PeaqService } from "./peaq.js";
import * as schemas from "./schemas.js";

// Load environment variables
dotenv.config();

const PEAQ_WS_URL = process.env.PEAQ_WS_URL || "wss://peaq.api.onfinality.io/public-ws";
const PEAQ_SEED_PHRASE = process.env.PEAQ_SEED_PHRASE;

class McpPeaqServer {
  private server: Server;
  private peaqService: PeaqService;

  constructor() {
    this.server = new Server(
      {
        name: "mcp-peaq",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.peaqService = new PeaqService(PEAQ_WS_URL, PEAQ_SEED_PHRASE);

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "get_machine_identity",
          description: "Read machine identity (DID) data for a given peaq address.",
          inputSchema: zodToJsonSchema(schemas.getMachineIdentitySchema),
        },
        {
          name: "register_device",
          description: "Register a new device on the peaq network.",
          inputSchema: zodToJsonSchema(schemas.registerDeviceSchema),
        },
        {
          name: "get_depin_events",
          description: "Retrieve recent DePIN events on the peaq network.",
          inputSchema: zodToJsonSchema(schemas.getDePINEventsSchema),
        },
        {
          name: "get_network_state",
          description: "Query the overall network state of peaq.",
          inputSchema: zodToJsonSchema(schemas.getNetworkStateSchema),
        },
        {
          name: "submit_transaction",
          description: "Submit a token transfer transaction on the peaq network.",
          inputSchema: zodToJsonSchema(schemas.submitTransactionSchema),
        },
        {
          name: "get_rewards_usage",
          description: "Query rewards and usage data for an address.",
          inputSchema: zodToJsonSchema(schemas.getRewardsUsageSchema),
        },
        {
          name: "get_staking_info",
          description: "Query staking and participation information for an address.",
          inputSchema: zodToJsonSchema(schemas.getStakingInfoSchema),
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "get_machine_identity":
            return await this.handleGetMachineIdentity(args as schemas.GetMachineIdentityArgs);
          case "register_device":
            return await this.handleRegisterDevice(args as schemas.RegisterDeviceArgs);
          case "get_depin_events":
            return await this.handleGetDePINEvents(args as schemas.GetDePINEventsArgs);
          case "get_network_state":
            return await this.handleGetNetworkState();
          case "submit_transaction":
            return await this.handleSubmitTransaction(args as schemas.SubmitTransactionArgs);
          case "get_rewards_usage":
            return await this.handleGetRewardsUsage(args as schemas.GetRewardsUsageArgs);
          case "get_staking_info":
            return await this.handleGetStakingInfo(args as schemas.GetStakingInfoArgs);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid arguments: ${error.errors.map((e: any) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
          );
        }
        return {
          content: [
            {
              type: "text",
              text: `Error executing ${name}: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  // --- Tool Implementations ---

  private async handleGetMachineIdentity(args: schemas.GetMachineIdentityArgs) {
    const validArgs = schemas.getMachineIdentitySchema.parse(args);
    const api = this.peaqService.getApi();

    // In a real scenario, this would interact with a specific peaq-did pallet
    // Here we'll do a basic account query to show capability
    const accountInfo = await api.query.system.account(validArgs.address);
    const data = accountInfo.toHuman();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            address: validArgs.address,
            machineData: data,
            message: "Machine identity queried successfully. Note: Fully resolving DID documents may require specialized pallets.",
          }, null, 2),
        },
      ],
    };
  }

  private async handleRegisterDevice(args: schemas.RegisterDeviceArgs): Promise<any> {
    const validArgs = schemas.registerDeviceSchema.parse(args);
    const api = this.peaqService.getApi();
    const signer = this.peaqService.getKeyringPair();

    // Emulating a device registration using the system's remark (as placeholder for the actual DID/RBAC pallet extrinsic)
    const remarkData = JSON.stringify({
      action: "register_device",
      name: validArgs.deviceName,
      data: validArgs.deviceData,
    });

    const extrinsic = api.tx.system.remark(remarkData);

    return new Promise((resolve, reject) => {
      extrinsic.signAndSend(signer, ({ status, events, dispatchError }) => {
        if (status.isInBlock || status.isFinalized) {
          let errorInfo = "";
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              const { docs, name, section } = decoded;
              errorInfo = `${section}.${name}: ${docs.join(' ')}`;
            } else {
              errorInfo = dispatchError.toString();
            }
          }

          if (errorInfo) {
            resolve({
              content: [{ type: "text", text: `Device registration failed: ${errorInfo}` }],
              isError: true,
            });
          } else {
            resolve({
              content: [
                {
                  type: "text",
                  text: `Device '${validArgs.deviceName}' registered successfully in block: ${status.asInBlock.toString()}`,
                },
              ],
            });
          }
        }
      }).catch((e) => {
        reject(e);
      });
    });
  }

  private async handleGetDePINEvents(args: schemas.GetDePINEventsArgs) {
    const validArgs = schemas.getDePINEventsSchema.parse(args);
    const api = this.peaqService.getApi();

    // Get the latest block events
    const signedBlock = await api.rpc.chain.getBlock();
    const allRecords = await api.query.system.events.at(signedBlock.block.header.hash);

    // Explicitly cast to any[] since different Polkadot versions type events differently
    const recordsArray = (allRecords as any) || [];

    const events = (Array.isArray(recordsArray) ? recordsArray : recordsArray.toArray ? recordsArray.toArray() : [])
      .slice(0, validArgs.limit)
      .map(({ event, phase }: any) => ({
        section: event?.section,
        method: event?.method,
        data: event?.data?.toHuman ? event.data.toHuman() : null,
      }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(events, null, 2),
        },
      ],
    };
  }

  private async handleGetNetworkState() {
    const api = this.peaqService.getApi();

    const [chain, nodeName, nodeVersion] = await Promise.all([
      api.rpc.system.chain(),
      api.rpc.system.name(),
      api.rpc.system.version(),
    ]);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            chain: chain.toString(),
            nodeName: nodeName.toString(),
            nodeVersion: nodeVersion.toString(),
            isConnected: api.isConnected,
          }, null, 2),
        },
      ],
    };
  }

  private async handleSubmitTransaction(args: schemas.SubmitTransactionArgs): Promise<any> {
    const validArgs = schemas.submitTransactionSchema.parse(args);
    const api = this.peaqService.getApi();
    const signer = this.peaqService.getKeyringPair();

    const transfer = api.tx.balances.transferAllowDeath(validArgs.toAddress, validArgs.amount);

    return new Promise((resolve, reject) => {
      transfer.signAndSend(signer, ({ status, dispatchError }) => {
        if (status.isInBlock || status.isFinalized) {
          if (dispatchError) {
             let errorInfo = dispatchError.toString();
             if (dispatchError.isModule) {
               const decoded = api.registry.findMetaError(dispatchError.asModule);
               errorInfo = `${decoded.section}.${decoded.name}`;
             }
             resolve({
               content: [{ type: "text", text: `Transaction failed: ${errorInfo}` }],
               isError: true,
             });
          } else {
            resolve({
              content: [
                {
                  type: "text",
                  text: `Transaction of ${validArgs.amount} tokens to ${validArgs.toAddress} successful in block: ${status.asInBlock.toString()}`,
                },
              ],
            });
          }
        }
      }).catch(reject);
    });
  }

  private async handleGetRewardsUsage(args: schemas.GetRewardsUsageArgs) {
    const validArgs = schemas.getRewardsUsageSchema.parse(args);
    // Placeholder for querying specific DePIN reward smart contracts/pallets
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            address: validArgs.address,
            message: "Rewards and usage logic requires connection to specific DePIN dApps/pallets. This is a placeholder.",
            estimatedRewards: "0 PEAQ",
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetStakingInfo(args: schemas.GetStakingInfoArgs) {
    const validArgs = schemas.getStakingInfoSchema.parse(args);
    const api = this.peaqService.getApi();

    // Query staking ledgers (if the chain supports standard staking pallets)
    let stakingData: any = { message: "Staking data not found or pallet not available" };
    try {
      if (api.query.staking && api.query.staking.ledger) {
        const ledgerInfo = await api.query.staking.ledger(validArgs.address);
        stakingData = ledgerInfo.toHuman() || "No staking active for this address.";
      }
    } catch (e) {
      console.error(e);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            address: validArgs.address,
            staking: stakingData,
          }, null, 2),
        },
      ],
    };
  }

  // --- Run Server ---

  async run() {
    await this.peaqService.init();
    console.error(`Connected to Peaq node at ${PEAQ_WS_URL}`);

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("mcp-peaq server running on stdio");
  }
}

const server = new McpPeaqServer();
server.run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
