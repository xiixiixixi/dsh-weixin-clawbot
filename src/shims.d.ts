declare module 'qrcode-terminal' {
  const qrcodeTerminal: {
    generate(text: string, opts?: { small?: boolean }): void;
  };
  export default qrcodeTerminal;
}
