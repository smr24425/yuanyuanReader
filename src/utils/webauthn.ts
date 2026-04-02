// src/utils/webauthn.ts

export const isWebAuthnAvailable = () => {
  return typeof window !== "undefined" && window.PublicKeyCredential !== undefined;
};

// Helper: buffer to base64
const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }
  return btoa(str);
};

// Helper: base64 to buffer
const base64ToBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export const registerBiometric = async (): Promise<string | null> => {
  if (!isWebAuthnAvailable()) return null;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: "淵淵閱讀",
        },
        user: {
          id: userId,
          name: "LocalUser",
          displayName: "讀者",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },  // ES256
          { type: "public-key", alg: -257 } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // FaceID/TouchID/Windows Hello
          userVerification: "required",
        },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential;

    if (credential && credential.rawId) {
      return bufferToBase64(credential.rawId);
    }
    return null;
  } catch (e) {
    console.error("Biometric registration failed:", e);
    return null;
  }
};

export const verifyBiometric = async (credentialIdBase64: string): Promise<boolean> => {
  if (!isWebAuthnAvailable()) return false;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const credentialId = base64ToBuffer(credentialIdBase64);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: credentialId,
            type: "public-key",
          },
        ],
        userVerification: "required",
      },
    });

    return !!assertion;
  } catch (e) {
    console.error("Biometric verification failed:", e);
    return false;
  }
};
