// Legacy preload window globals
declare global {
    const ComlinkWorker: {
        new <T>(url: URL): T;
    };

    namespace JSX {
        interface IntrinsicElements {
            [element: string]: any;
        }
    }

    interface Window {
        api: unknown;
        tianshu?: unknown;
    }
}
export {};
