import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { KeyringPair } from '@polkadot/keyring/types';
import { cryptoWaitReady } from '@polkadot/util-crypto';

export class PeaqService {
  private api: ApiPromise | null = null;
  private keyringPair: KeyringPair | null = null;

  constructor(
    private readonly wsUrl: string,
    private readonly seedPhrase?: string
  ) {}

  /**
   * Initialize the connection to the peaq network and set up the keyring.
   */
  public async init(): Promise<void> {
    const provider = new WsProvider(this.wsUrl);

    // Initialize API
    this.api = await ApiPromise.create({ provider });

    // Initialize crypto and keyring if a seed phrase is provided
    if (this.seedPhrase) {
      await cryptoWaitReady();
      const keyring = new Keyring({ type: 'sr25519' });
      this.keyringPair = keyring.addFromUri(this.seedPhrase);
    }
  }

  /**
   * Get the Polkadot API instance.
   */
  public getApi(): ApiPromise {
    if (!this.api) {
      throw new Error("Peaq API not initialized. Call init() first.");
    }
    return this.api;
  }

  /**
   * Get the Keyring Pair for signing transactions.
   */
  public getKeyringPair(): KeyringPair {
    if (!this.keyringPair) {
      throw new Error("Keyring not initialized. Please provide PEAQ_SEED_PHRASE.");
    }
    return this.keyringPair;
  }
}
