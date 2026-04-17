const sha256 = async (message: string): Promise<string> => {
  // encode as (utf-8) Uint8Array
  const msgUint8: Uint8Array = new TextEncoder().encode(message);

  // hash the message
  const hashBuffer: ArrayBuffer = await crypto.subtle.digest('SHA-256', msgUint8);

  // convert buffer to byte array
  const hashArray: number[] = Array.from(new Uint8Array(hashBuffer));

  // convert bytes to hex string
  const hashHex: string = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

export default sha256;
