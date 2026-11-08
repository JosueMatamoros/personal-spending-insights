// Desbloqueo con Face ID / Touch ID / huella usando WebAuthn (passkey del dispositivo).
// Protege abrir la app en este celular; la cuenta sigue protegida por la contraseña.
const K = 'misgastos.faceid';

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const azar = (n) => crypto.getRandomValues(new Uint8Array(n));

export async function faceIdDisponible() {
  try {
    return Boolean(window.PublicKeyCredential) &&
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

export function faceIdActivo() {
  try { return Boolean(localStorage.getItem(K)); } catch { return false; }
}

export async function activarFaceId() {
  const cred = await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Mis Gastos' },
      user: { id: azar(16), name: 'Mis Gastos', displayName: 'Mis Gastos' },
      challenge: azar(32),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
      attestation: 'none',
    },
  });
  localStorage.setItem(K, b64(cred.rawId));
}

export async function verificarFaceId() {
  const id = localStorage.getItem(K);
  if (!id) return true;
  await navigator.credentials.get({
    publicKey: {
      challenge: azar(32),
      allowCredentials: [{ type: 'public-key', id: deB64(id), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  return true;
}

export function desactivarFaceId() {
  try { localStorage.removeItem(K); } catch { /* nada */ }
}

export const K_PREGUNTADO = 'misgastos.faceid.preguntado';
