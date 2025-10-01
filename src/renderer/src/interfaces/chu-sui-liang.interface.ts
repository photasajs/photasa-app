/**
 * 褚遂良中书令 - 唐朝著名书法家、政治家
 */
export interface IChusuiliangService {
    /**
     * 初始化偏好设置
     */
    initializePreferences(): Promise<void>;
}

/**
 * Vue注入令牌
 * 用于provide/inject的类型安全标识
 */
export const CHU_SUI_LIANG_TOKEN = Symbol("Chusuiliang");
