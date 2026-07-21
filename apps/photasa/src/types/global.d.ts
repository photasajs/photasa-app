// toolkit electronAPI 类型（可根据 @electron-toolkit/preload 类型声明导入）
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
        api: any;
        electron?: any;
        tianshu?: any;
    }
}
export {};
