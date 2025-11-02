/**
 * 玄奘服务接口 - 唐朝著名翻译家、佛教大师
 */

export interface IXuanzangService {
    initializeLocalization(): Promise<void>;

    translate(text: string): string;
}

export const XUANZANG_TOKEN = Symbol("Xuanzang");
