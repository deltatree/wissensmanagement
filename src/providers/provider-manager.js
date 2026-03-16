import { LocalBrowserProvider } from "./local-browser-provider.js";
import { AzureProvider } from "./azure-provider.js";

export class ProviderManager {
  constructor(stateAccessor) {
    this.stateAccessor = stateAccessor;
    this.localProvider = null;
    this.azureProvider = null;
  }

  _state() {
    return this.stateAccessor();
  }

  _ensureLocal() {
    if (!this.localProvider) {
      this.localProvider = new LocalBrowserProvider(this._state().providers.local);
    }
    this.localProvider.setConfig(this._state().providers.local);
    return this.localProvider;
  }

  _ensureAzure() {
    if (!this.azureProvider) {
      this.azureProvider = new AzureProvider(this._state().providers.azure);
    }
    this.azureProvider.setConfig(this._state().providers.azure);
    return this.azureProvider;
  }

  getActiveProvider() {
    const mode = this._state().settings.activeProvider;
    if (mode === "azure") {
      return this._ensureAzure();
    }
    return this._ensureLocal();
  }

  getProviderById(providerId) {
    if (providerId === "azure") {
      return this._ensureAzure();
    }
    return this._ensureLocal();
  }
}
