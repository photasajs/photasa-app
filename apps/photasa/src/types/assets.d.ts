declare module "*.yml" {
    const value: unknown;
    export default value;
}

declare module "*.css?raw" {
    const content: string;
    export default content;
}
