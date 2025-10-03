/**
 * 褚遂良中书令 - 唐朝著名书法家、政治家
 * 负责统一偏好设置管理，通过奏折与房玄龄通信
 *
 * 设计原则：
 * - 所有偏好设置的更新都通过褚遂良处理
 * - 褚遂良通过奏折与房玄龄通信，不直接操作Store
 * - UI组件只需要调用褚遂良的方法，不需要了解奏折细节
 */
export interface IChusuiliangService {
    /**
     * 初始化偏好设置
     */
    initializePreferences(): Promise<void>;

    /**
     * 更新主题设置
     * @param themeId 主题ID
     */
    updateTheme(themeId: string): Promise<void>;

    /**
     * 获取主题设置
     */
    get currentTheme(): string;

    /**
     * 设置主题设置
     */
    set currentTheme(themeId: string);

    /**
     * 更新语言设置
     * @param locale 语言代码
     */
    updateLanguage(locale: string): Promise<void>;

    /**
     * 获取缩略图大小
     */
    get thumbnailSize(): number;

    /**
     * 设置缩略图大小
     */
    set thumbnailSize(size: number);
}

/**
 * Vue注入令牌
 * 用于provide/inject的类型安全标识
 */
export const CHU_SUI_LIANG_TOKEN = Symbol("Chusuiliang");
