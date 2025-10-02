/**
 * 📜 天枢工作流Schema到TypeScript类型生成器
 *
 * 🌌 仙术功能：将JSON Schema转换为TypeScript类型定义
 * 🔧 工作流操作：从Schema中提取类型信息并生成完整的TS接口
 */

import * as fs from "fs";
import * as path from "path";

export interface GeneratorOptions {
    /** 输入Schema文件路径 */
    schemaPath: string;
    /** 输出TypeScript文件路径 */
    outputPath: string;
    /** 导出名称前缀 */
    namePrefix?: string;
    /** 是否生成运行时验证器 */
    generateValidators?: boolean;
    /** 是否生成文档注释 */
    generateDocs?: boolean;
}

export interface SchemaDefinition {
    $schema?: string;
    $id?: string;
    title?: string;
    description?: string;
    type: string;
    properties?: Record<string, any>;
    definitions?: Record<string, any>;
    required?: string[];
    enum?: any[];
    items?: any;
    oneOf?: any[];
    allOf?: any[];
    if?: any;
    then?: any;
    else?: any;
}

export class SchemaToTypesGenerator {
    private options: GeneratorOptions;
    private generatedTypes = new Set<string>();

    constructor(options: GeneratorOptions) {
        this.options = options;
    }

    /**
     * 🌌 主要生成仙术：执行Schema到类型的转换
     */
    async generate(): Promise<void> {
        console.log("🌌 启动Schema到TypeScript生成仙术...");

        // 读取Schema文件
        const schemaContent = await this.readSchemaFile();
        const schema = JSON.parse(schemaContent) as SchemaDefinition;

        // 生成TypeScript代码
        const tsContent = this.generateTypeScriptContent(schema);

        // 写入输出文件
        await this.writeOutputFile(tsContent);

        console.log("🌌 仙术完成，TypeScript类型已生成");
    }

    private async readSchemaFile(): Promise<string> {
        console.log(`📜 读取Schema典籍: ${this.options.schemaPath}`);
        return fs.promises.readFile(this.options.schemaPath, "utf-8");
    }

    private async writeOutputFile(content: string): Promise<void> {
        console.log(`📜 书写TypeScript典籍: ${this.options.outputPath}`);

        // 确保输出目录存在
        const outputDir = path.dirname(this.options.outputPath);
        await fs.promises.mkdir(outputDir, { recursive: true });

        await fs.promises.writeFile(this.options.outputPath, content, "utf-8");
    }

    private generateTypeScriptContent(schema: SchemaDefinition): string {
        const parts: string[] = [];

        // 文件头部注释
        parts.push(this.generateFileHeader(schema));

        // 生成主接口
        if (schema.type === "object" && schema.properties) {
            const mainInterfaceName = this.getMainInterfaceName(schema);
            parts.push(this.generateInterface(mainInterfaceName, schema));
        }

        // 生成definitions中的类型
        if (schema.definitions) {
            for (const [name, definition] of Object.entries(schema.definitions)) {
                parts.push(this.generateDefinitionType(name, definition));
            }
        }

        // 生成导出语句
        parts.push(this.generateExports(schema));

        return parts.join("\n\n");
    }

    private generateFileHeader(schema: SchemaDefinition): string {
        const title = schema.title || "Generated Types";
        const description =
            schema.description || "Auto-generated TypeScript types from JSON Schema";

        return `/**
 * ${title}
 *
 * ${description}
 *
 * 🌌 此文件由天枢Schema生成器自动生成，请勿手动修改
 * 📜 生成时间: ${new Date().toISOString()}
 */

/* eslint-disable */
// @ts-nocheck`;
    }

    private getMainInterfaceName(schema: SchemaDefinition): string {
        if (schema.title) {
            return this.toPascalCase(schema.title);
        }
        const prefix = this.options.namePrefix || "Generated";
        return `${prefix}Schema`;
    }

    private generateInterface(name: string, schema: SchemaDefinition): string {
        const lines: string[] = [];

        // 接口文档
        if (this.options.generateDocs && schema.description) {
            lines.push(`/**`);
            lines.push(` * ${schema.description}`);
            lines.push(` */`);
        }

        lines.push(`export interface ${name} {`);

        if (schema.properties) {
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
                const isRequired = schema.required?.includes(propName) ?? false;
                const propType = this.generatePropertyType(propName, propSchema, isRequired);
                lines.push(`  ${propType}`);
            }
        }

        lines.push(`}`);

        this.generatedTypes.add(name);
        return lines.join("\n");
    }

    private generatePropertyType(name: string, schema: any, isRequired: boolean): string {
        const optional = isRequired ? "" : "?";
        const type = this.schemaToType(schema);
        const comment = schema.description ? ` // ${schema.description}` : "";

        return `${name}${optional}: ${type};${comment}`;
    }

    private schemaToType(schema: any): string {
        if (typeof schema === "string") {
            return schema;
        }

        if (schema.$ref) {
            return this.resolveRef(schema.$ref);
        }

        if (schema.enum) {
            return schema.enum.map((v: any) => JSON.stringify(v)).join(" | ");
        }

        if (schema.oneOf) {
            return schema.oneOf.map((s: any) => this.schemaToType(s)).join(" | ");
        }

        if (schema.allOf) {
            return schema.allOf.map((s: any) => this.schemaToType(s)).join(" & ");
        }

        if (schema.type === "array") {
            const itemType = schema.items ? this.schemaToType(schema.items) : "any";
            return `${itemType}[]`;
        }

        if (schema.type === "object") {
            if (schema.properties) {
                return this.generateInlineObjectType(schema);
            }
            if (schema.patternProperties) {
                const valueType = Object.values(schema.patternProperties)[0];
                return `Record<string, ${this.schemaToType(valueType)}>`;
            }
            return "Record<string, any>";
        }

        // 基本类型映射
        const typeMap: Record<string, string> = {
            string: "string",
            number: "number",
            integer: "number",
            boolean: "boolean",
            null: "null",
        };

        return typeMap[schema.type] || "any";
    }

    private generateInlineObjectType(schema: any): string {
        const parts: string[] = ["{"];

        if (schema.properties) {
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
                const isRequired = schema.required?.includes(propName) ?? false;
                const optional = isRequired ? "" : "?";
                const type = this.schemaToType(propSchema);
                parts.push(`  ${propName}${optional}: ${type};`);
            }
        }

        parts.push("}");
        return parts.join("\n");
    }

    private resolveRef(ref: string): string {
        // 处理 #/definitions/TypeName 格式的引用
        const match = ref.match(/^#\/definitions\/(.+)$/);
        if (match) {
            return match[1];
        }

        // 处理其他格式的引用
        return ref.split("/").pop() || "unknown";
    }

    private generateDefinitionType(name: string, definition: any): string {
        if (definition.type === "object") {
            return this.generateInterface(name, definition);
        }

        if (definition.enum) {
            return this.generateEnum(name, definition);
        }

        if (definition.oneOf || definition.allOf) {
            return this.generateUnionType(name, definition);
        }

        // 生成类型别名
        const type = this.schemaToType(definition);
        const description = definition.description ? `\n * ${definition.description}` : "";

        return `/**${description}
 */
export type ${name} = ${type};`;
    }

    private generateEnum(name: string, definition: any): string {
        const lines: string[] = [];

        if (this.options.generateDocs && definition.description) {
            lines.push(`/**`);
            lines.push(` * ${definition.description}`);
            lines.push(` */`);
        }

        lines.push(`export enum ${name} {`);

        for (const value of definition.enum) {
            const enumKey = this.toEnumKey(value);
            lines.push(`  ${enumKey} = ${JSON.stringify(value)},`);
        }

        lines.push(`}`);

        this.generatedTypes.add(name);
        return lines.join("\n");
    }

    private generateUnionType(name: string, definition: any): string {
        let type: string;

        if (definition.oneOf) {
            type = definition.oneOf.map((s: any) => this.schemaToType(s)).join(" | ");
        } else if (definition.allOf) {
            type = definition.allOf.map((s: any) => this.schemaToType(s)).join(" & ");
        } else {
            type = "any";
        }

        const description = definition.description ? `\n * ${definition.description}` : "";

        return `/**${description}
 */
export type ${name} = ${type};`;
    }

    private generateExports(schema: SchemaDefinition): string {
        const exports: string[] = [];

        // 导出主类型
        const mainType = this.getMainInterfaceName(schema);
        if (this.generatedTypes.has(mainType)) {
            exports.push(`export { ${mainType} }`);
        }

        // 导出所有生成的类型
        const allTypes = Array.from(this.generatedTypes).sort();
        if (allTypes.length > 0) {
            exports.push(`export type {`);
            exports.push(`  ${allTypes.join(",\n  ")}`);
            exports.push(`};`);
        }

        return exports.join("\n");
    }

    private toPascalCase(str: string): string {
        return str
            .replace(/[^a-zA-Z0-9]/g, " ")
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join("");
    }

    private toEnumKey(value: any): string {
        if (typeof value === "string") {
            return value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "_")
                .replace(/^(\d)/, "_$1"); // 数字开头的加下划线
        }
        return `VALUE_${value}`;
    }
}

/**
 * 🔧 便捷生成仙术：快速生成类型定义
 */
export async function generateTypesFromSchema(options: GeneratorOptions): Promise<void> {
    const generator = new SchemaToTypesGenerator(options);
    await generator.generate();
}

/**
 * 🌌 批量生成仙术：处理多个Schema文件
 */
export async function generateTypesFromSchemas(
    schemaDir: string,
    outputDir: string,
    options: Partial<GeneratorOptions> = {},
): Promise<void> {
    console.log("🌌 启动批量Schema生成仙术...");

    const schemaFiles = await fs.promises.readdir(schemaDir);
    const jsonSchemas = schemaFiles.filter((file) => file.endsWith(".schema.json"));

    for (const schemaFile of jsonSchemas) {
        const baseName = path.basename(schemaFile, ".schema.json");
        const schemaPath = path.join(schemaDir, schemaFile);
        const outputPath = path.join(outputDir, `${baseName}.types.ts`);

        await generateTypesFromSchema({
            schemaPath,
            outputPath,
            namePrefix: options.namePrefix || baseName,
            generateValidators: options.generateValidators ?? true,
            generateDocs: options.generateDocs ?? true,
        });
    }

    console.log("🌌 批量生成仙术完成");
}
