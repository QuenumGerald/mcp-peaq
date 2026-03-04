import { z } from "zod";

export const getMachineIdentitySchema = z.object({
  address: z.string().describe("The machine's peaq network address (DID)."),
});

export const registerDeviceSchema = z.object({
  deviceName: z.string().describe("The name of the device to register."),
  deviceData: z.string().optional().describe("Additional data for the device."),
});

export const getDePINEventsSchema = z.object({
  limit: z.number().optional().default(10).describe("The number of recent events to retrieve."),
});

export const getNetworkStateSchema = z.object({});

export const submitTransactionSchema = z.object({
  toAddress: z.string().describe("The recipient address on the peaq network."),
  amount: z.number().describe("The amount of tokens to send."),
});

export const getRewardsUsageSchema = z.object({
  address: z.string().describe("The address to query for rewards/usage."),
});

export const getStakingInfoSchema = z.object({
  address: z.string().describe("The address to query staking information for."),
});

export type GetMachineIdentityArgs = z.infer<typeof getMachineIdentitySchema>;
export type RegisterDeviceArgs = z.infer<typeof registerDeviceSchema>;
export type GetDePINEventsArgs = z.infer<typeof getDePINEventsSchema>;
export type GetNetworkStateArgs = z.infer<typeof getNetworkStateSchema>;
export type SubmitTransactionArgs = z.infer<typeof submitTransactionSchema>;
export type GetRewardsUsageArgs = z.infer<typeof getRewardsUsageSchema>;
export type GetStakingInfoArgs = z.infer<typeof getStakingInfoSchema>;
