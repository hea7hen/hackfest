declare module 'pdf-parse/lib/pdf-parse.js' {
  function pdfParse(data: Buffer): Promise<{
    numpages: number;
    text: string;
  }>;
  export default pdfParse;
}

declare module 'pdf-parse' {
  function pdfParse(data: Buffer): Promise<{
    numpages: number;
    text: string;
  }>;
  export default pdfParse;
}
