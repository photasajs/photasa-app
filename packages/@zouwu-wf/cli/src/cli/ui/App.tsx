import React from "react";
import { Box, Text } from "ink";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";
import { ValidationResult } from "./ValidationResult";
import { ValidationError } from "@zouwu-wf/workflow";

interface AppProps {
    results: Array<{
        file: string;
        valid: boolean;
        errors: ValidationError[];
    }>;
}

export const App: React.FC<AppProps> = ({ results }) => {
    const totalErrors = results.reduce((acc, curr) => acc + curr.errors.length, 0);
    const hasErrors = totalErrors > 0;

    return (
        <Box flexDirection="column" padding={1}>
            <Box marginBottom={1}>
                <Gradient name="morning">
                    <BigText text="Zouwu" font="block" />
                </Gradient>
            </Box>
            <Box marginBottom={1}>
                <Text bold>🌌 天枢仙府 · 工作流秘籍验证阵法</Text>
            </Box>

            <Box flexDirection="column" marginBottom={1}>
                {results.map((result, index) => (
                    <ValidationResult key={index} {...result} />
                ))}
            </Box>

            <Box borderStyle="round" borderColor={hasErrors ? "red" : "green"} padding={1}>
                <Text>
                    📊 总览: {results.length} 卷秘籍, {totalErrors} 个谬误
                </Text>
            </Box>
        </Box>
    );
};
