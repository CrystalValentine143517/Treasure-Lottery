import { bytesToHex, getAddress } from "viem";
import type { Address } from "viem";
import { CONTRACT_ADDRESS } from "@/config/contract";

declare global {
    interface Window {
        RelayerSDK?: any;
        relayerSDK?: any;
        ethereum?: any;
        okxwallet?: any;
    }
}

let fheInstance: any = null;

const getSDK = () => {
    if (typeof window === "undefined") {
        throw new Error("FHE SDK requires a browser environment");
    }
    const sdk = window.RelayerSDK || window.relayerSDK;
    if (!sdk) {
        throw new Error("Relayer SDK not loaded. Ensure the CDN script tag is present.");
    }
    return sdk;
};

export const initializeFHE = async (provider?: any) => {
    if (fheInstance) return fheInstance;
    if (typeof window === "undefined") {
        throw new Error("FHE SDK requires a browser environment");
    }

    const ethereumProvider =
        provider || window.ethereum || window.okxwallet?.provider || window.okxwallet;
    if (!ethereumProvider) {
        throw new Error("No wallet provider detected. Connect a wallet first.");
    }

    const sdk = getSDK();
    const { initSDK, createInstance, SepoliaConfig } = sdk;
    await initSDK();
    const config = { ...SepoliaConfig, network: ethereumProvider };
    fheInstance = await createInstance(config);
    return fheInstance;
};

const getInstance = async (provider?: any) => {
    if (fheInstance) return fheInstance;
    return initializeFHE(provider);
};

/**
 * Encrypt an answer value (euint32) for treasure box game
 * @param userAddress - The user's wallet address
 * @param answer - The answer value to encrypt
 * @param provider - Optional ethereum provider
 */
export const encryptAnswer = async (
    userAddress: Address,
    answer: number,
    provider?: any
): Promise<{
    handle: `0x${string}`;
    proof: `0x${string}`;
}> => {
    console.log('[FHE] Encrypting answer:', answer);
    const instance = await getInstance(provider);
    const contractAddr = getAddress(CONTRACT_ADDRESS);
    const userAddr = getAddress(userAddress);

    console.log('[FHE] Creating encrypted input for:', {
        contract: contractAddr,
        user: userAddr,
    });

    const input = instance.createEncryptedInput(contractAddr, userAddr);
    input.add32(answer);  // euint32 for answer

    console.log('[FHE] Encrypting input...');
    const { handles, inputProof } = await input.encrypt();
    console.log('[FHE] Encryption complete, handles:', handles.length);

    if (handles.length < 1) {
        throw new Error('FHE SDK returned insufficient handles');
    }

    return {
        handle: bytesToHex(handles[0]) as `0x${string}`,
        proof: bytesToHex(inputProof) as `0x${string}`,
    };
};

/**
 * Encrypt a guess value (euint32) for challenge game
 * @param userAddress - The user's wallet address
 * @param guess - The guess value to encrypt
 * @param provider - Optional ethereum provider
 */
export const encryptGuess = async (
    userAddress: Address,
    guess: number,
    provider?: any
): Promise<{
    handle: `0x${string}`;
    proof: `0x${string}`;
}> => {
    console.log('[FHE] Encrypting guess:', guess);
    const instance = await getInstance(provider);
    const contractAddr = getAddress(CONTRACT_ADDRESS);
    const userAddr = getAddress(userAddress);

    const input = instance.createEncryptedInput(contractAddr, userAddr);
    input.add32(guess);  // euint32 for guess

    const { handles, inputProof } = await input.encrypt();

    if (handles.length < 1) {
        throw new Error('FHE SDK returned insufficient handles');
    }

    return {
        handle: bytesToHex(handles[0]) as `0x${string}`,
        proof: bytesToHex(inputProof) as `0x${string}`,
    };
};

/**
 * Check if FHE SDK is loaded and ready
 */
export const isFHEReady = (): boolean => {
    if (typeof window === "undefined") return false;
    return !!(window.RelayerSDK || window.relayerSDK);
};

/**
 * Check if FHE instance is initialized
 */
export const isFheInstanceReady = (): boolean => {
    return fheInstance !== null;
};

/**
 * Wait for FHE SDK to be loaded (with timeout)
 */
export const waitForFHE = async (timeoutMs: number = 10000): Promise<boolean> => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        if (isFHEReady()) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return false;
};

/**
 * Get FHE status for debugging
 */
export const getFHEStatus = (): {
    sdkLoaded: boolean;
    instanceReady: boolean;
} => {
    return {
        sdkLoaded: isFHEReady(),
        instanceReady: fheInstance !== null,
    };
};

/**
 * Reset FHE instance (for testing or reconnection)
 */
export const resetFHEInstance = (): void => {
    fheInstance = null;
};

/**
 * Request public decryption for an encrypted boolean handle
 * Uses the publicDecrypt API from Zama Relayer SDK
 * @param handle - The encrypted boolean handle (bytes32)
 * @param provider - Optional ethereum provider
 * @returns The decrypted boolean and proof
 */
export const requestDecryption = async (
    handle: `0x${string}`,
    provider?: any
): Promise<{
    decryptedResult: boolean;
    decryptionProof: `0x${string}`;
}> => {
    console.log('[FHE] Requesting public decryption for handle:', handle);
    const instance = await getInstance(provider);

    try {
        // Use publicDecrypt API (Zama fhEVM v0.9.1 self-relaying model)
        const results = await instance.publicDecrypt([handle]);
        console.log('[FHE] Public decryption results:', results);

        // Extract the cleartext value for this handle
        const clearValue = results.clearValues[handle];
        console.log('[FHE] Clear value:', clearValue, 'type:', typeof clearValue);

        // Convert to boolean (handle both bigint and boolean responses)
        let decryptedResult: boolean;
        if (typeof clearValue === 'boolean') {
            decryptedResult = clearValue;
        } else if (typeof clearValue === 'bigint') {
            decryptedResult = clearValue !== 0n;
        } else {
            // Fallback: treat truthy values as true
            decryptedResult = !!clearValue;
        }

        return {
            decryptedResult,
            decryptionProof: results.decryptionProof as `0x${string}`,
        };
    } catch (error) {
        console.error('[FHE] Public decryption error:', error);
        throw error;
    }
};

/**
 * Request decryption with retry mechanism
 * @param handle - The encrypted handle
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelayMs - Delay between retries in milliseconds
 */
export const requestDecryptionWithRetry = async (
    handle: `0x${string}`,
    maxRetries: number = 10,
    retryDelayMs: number = 3000,
    provider?: any
): Promise<{
    decryptedResult: boolean;
    decryptionProof: `0x${string}`;
}> => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[FHE] Decryption attempt ${attempt}/${maxRetries}`);
            const result = await requestDecryption(handle, provider);
            console.log('[FHE] Decryption successful on attempt', attempt);
            return result;
        } catch (error: any) {
            lastError = error;
            console.log(`[FHE] Decryption attempt ${attempt} failed:`, error?.message);

            if (attempt < maxRetries) {
                console.log(`[FHE] Retrying in ${retryDelayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            }
        }
    }

    throw lastError || new Error('Decryption failed after max retries');
};
