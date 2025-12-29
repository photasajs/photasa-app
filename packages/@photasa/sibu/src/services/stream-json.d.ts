/**
 * Type declarations for stream-json/Assembler
 */

declare module "stream-json/Assembler" {
    class Assembler {
        constructor();
        consume(chunk: any): void;
        current: any;
    }
    export = Assembler;
}
