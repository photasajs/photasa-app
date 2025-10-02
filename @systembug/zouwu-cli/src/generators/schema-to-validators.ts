/**
 * 📜 天枢工作流Schema到验证器生成器
 *
 * 🌌 仙术功能：从JSON Schema生成运行时验证器
 * 🔧 工作流操作：生成Ajv验证器和TypeScript验证函数
 */

import * as fs from "fs";
import * as path from "path";

export interface ValidatorGeneratorOptions {
    /** 输入Schema文件路径 */
    schemaPath: string;
    /** 输出验证器文件路径 */
    outputPath: string;
    /** 验证器名称前缀 */
    namePrefix?: string;
    /** 是否生成严格模式验证器 */
    strict?: boolean;
    /** 是否生成错误信息的中文版本 */
    chineseErrors?: boolean;
}

export interface ValidationError {
    path: string;
    message: string;
    value?: any;
    schema?: any;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    data?: any;
}

export class SchemaToValidatorsGenerator {
    private options: ValidatorGeneratorOptions;

    constructor(options: ValidatorGeneratorOptions) {
        this.options = options;
    }

    /**
     * 🌌 主要验证器生成仙术
     */
    async generate(): Promise<void> {
        console.log("🌌 启动Schema到验证器生成仙术...");

        // 读取Schema文件
        const schemaContent = await this.readSchemaFile();
        const schema = JSON.parse(schemaContent);

        // 生成验证器代码
        const validatorContent = this.generateValidatorContent(schema);

        // 写入输出文件
        await this.writeOutputFile(validatorContent);

        console.log("🌌 验证器仙术完成");
    }

    private async readSchemaFile(): Promise<string> {
        console.log(`📜 读取Schema典籍: ${this.options.schemaPath}`);
        return fs.promises.readFile(this.options.schemaPath, "utf-8");
    }

    private async writeOutputFile(content: string): Promise<void> {
        console.log(`📜 书写验证器典籍: ${this.options.outputPath}`);

        const outputDir = path.dirname(this.options.outputPath);
        await fs.promises.mkdir(outputDir, { recursive: true });

        await fs.promises.writeFile(this.options.outputPath, content, "utf-8");
    }

    private generateValidatorContent(schema: any): string {
        const parts: string[] = [];

        // 文件头部
        parts.push(this.generateFileHeader(schema));

        // 导入依赖
        parts.push(this.generateImports());

        // Schema定义
        parts.push(this.generateSchemaDefinition(schema));

        // 验证器工厂
        parts.push(this.generateValidatorFactory());

        // 验证函数
        parts.push(this.generateValidationFunctions(schema));

        // 错误处理工具
        parts.push(this.generateErrorUtilities());

        // 导出语句
        parts.push(this.generateExports());

        return parts.join("\n\n");
    }

    private generateFileHeader(schema: any): string {
        const title = schema.title || "Generated Validators";

        return `/**
 * ${title} - 验证器
 *
 * 🌌 此文件由天枢Schema验证器生成器自动生成，请勿手动修改
 * 📜 生成时间: ${new Date().toISOString()}
 * 🔧 支持功能：结构验证、模板语法验证、自定义错误信息
 */

/* eslint-disable */
// @ts-nocheck`;
    }

    private generateImports(): string {
        return `import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

export interface ValidationError {
  path: string;
  message: string;
  value?: any;
  schema?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  data?: any;
}`;
    }

    private generateSchemaDefinition(schema: any): string {
        const schemaStr = JSON.stringify(schema, null, 2);
        const prefix = this.options.namePrefix || "workflow";

        return `/**
 * 📜 原始Schema定义
 */
const ${prefix}Schema = ${schemaStr} as const;`;
    }

    private generateValidatorFactory(): string {
        const prefix = this.options.namePrefix || "workflow";
        const strict = this.options.strict ? "true" : "false";

        return `/**
 * 🌌 验证器工厂 - 创建Ajv验证器实例
 */
function createValidator(): ValidateFunction {
  const ajv = new Ajv({
    allErrors: true,
    verbose: true,
    strict: ${strict},
    removeAdditional: false,
    useDefaults: true
  });

  // 添加格式验证支持
  addFormats(ajv);

  // 编译Schema
  const validate = ajv.compile(${prefix}Schema);
  return validate;
}

/**
 * 🔧 全局验证器实例
 */
const validator = createValidator();`;
    }

    private generateValidationFunctions(_schema: any): string {
        const prefix = this.options.namePrefix || "workflow";
        const chineseErrors = this.options.chineseErrors;

        return `/**
 * 🌌 主要验证仙术 - 验证数据是否符合Schema
 */
export function validate${this.toPascalCase(prefix)}(data: any): ValidationResult {
  const isValid = validator(data);

  if (isValid) {
    return {
      valid: true,
      errors: [],
      data
    };
  }

  const errors = (validator.errors || []).map(error => ({
    path: error.instancePath || error.schemaPath || '',
    message: ${chineseErrors ? "translateErrorMessage(error.message || '')" : "error.message || '验证失败'"},
    value: error.data,
    schema: error.schema
  }));

  return {
    valid: false,
    errors,
    data
  };
}

/**
 * 🔧 快速验证仙术 - 仅返回验证结果
 */
export function isValid${this.toPascalCase(prefix)}(data: any): boolean {
  return validator(data);
}

/**
 * 🌌 严格验证仙术 - 验证失败时抛出异常
 */
export function validateStrict${this.toPascalCase(prefix)}(data: any): any {
  const result = validate${this.toPascalCase(prefix)}(data);

  if (!result.valid) {
    const errorMessage = result.errors.map(e => \`\${e.path}: \${e.message}\`).join('; ');
    throw new Error(\`【符咒解析】验证失败: \${errorMessage}\`);
  }

  return result.data;
}`;
    }

    private generateErrorUtilities(): string {
        if (!this.options.chineseErrors) {
            return "";
        }

        return `/**
 * 🌌 错误信息翻译仙术 - 将英文错误信息转换为中文
 */
function translateErrorMessage(message: string): string {
  const translations: Record<string, string> = {
    'must be object': '必须是对象类型',
    'must be string': '必须是字符串类型',
    'must be number': '必须是数字类型',
    'must be boolean': '必须是布尔类型',
    'must be array': '必须是数组类型',
    'must have required property': '缺少必需属性',
    'must be equal to one of the allowed values': '必须是允许的值之一',
    'must match pattern': '必须匹配指定模式',
    'must be >= ': '必须大于等于 ',
    'must be <= ': '必须小于等于 ',
    'must be > ': '必须大于 ',
    'must be < ': '必须小于 ',
    'must NOT have additional properties': '不允许有额外属性',
    'must have at least': '至少需要',
    'must have at most': '最多允许',
    'items': '项'
  };

  let translated = message;
  for (const [english, chinese] of Object.entries(translations)) {
    translated = translated.replace(new RegExp(english, 'gi'), chinese);
  }

  return translated;
}`;
    }

    private generateExports(): string {
        const prefix = this.options.namePrefix || "workflow";
        const pascalPrefix = this.toPascalCase(prefix);

        return `// 🌌 导出所有验证仙术
export {
  validate${pascalPrefix},
  isValid${pascalPrefix},
  validateStrict${pascalPrefix}
};

// 📜 导出Schema定义
export { ${prefix}Schema };

// 🔧 导出类型定义
export type { ValidationError, ValidationResult };`;
    }

    private toPascalCase(str: string): string {
        return str
            .replace(/[^a-zA-Z0-9]/g, " ")
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join("");
    }
}

/**
 * 🔧 便捷验证器生成仙术
 */
export async function generateValidatorsFromSchema(
    options: ValidatorGeneratorOptions,
): Promise<void> {
    const generator = new SchemaToValidatorsGenerator(options);
    await generator.generate();
}

/**
 * 🌌 批量验证器生成仙术
 */
export async function generateValidatorsFromSchemas(
    schemaDir: string,
    outputDir: string,
    options: Partial<ValidatorGeneratorOptions> = {},
): Promise<void> {
    console.log("🌌 启动批量验证器生成仙术...");

    const schemaFiles = await fs.promises.readdir(schemaDir);
    const jsonSchemas = schemaFiles.filter((file) => file.endsWith(".schema.json"));

    for (const schemaFile of jsonSchemas) {
        const baseName = path.basename(schemaFile, ".schema.json");
        const schemaPath = path.join(schemaDir, schemaFile);
        const outputPath = path.join(outputDir, `${baseName}.validators.ts`);

        await generateValidatorsFromSchema({
            schemaPath,
            outputPath,
            namePrefix: options.namePrefix || baseName,
            strict: options.strict ?? true,
            chineseErrors: options.chineseErrors ?? true,
        });
    }

    console.log("🌌 批量验证器生成仙术完成");
}
