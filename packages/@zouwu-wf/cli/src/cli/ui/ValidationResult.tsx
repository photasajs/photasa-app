import React from "react";
import { Box, Text } from "ink";
import { ValidationError } from "@zouwu-wf/workflow";

interface ValidationResultProps {
    file: string;
    errors: ValidationError[];
    valid: boolean;
}

export const ValidationResult: React.FC<ValidationResultProps> = ({ file, errors, valid }) => {
    return (
        <Box flexDirection="column" marginBottom={1}>
            <Text bold underline>
                {file}
            </Text>
            {valid ? (
                <Text color="green"> ✨ 验证通过</Text>
            ) : (
                <Box flexDirection="column" marginLeft={2}>
                    <Text color="red"> ❌ 验证失败 ({errors.length} 个错误):</Text>
                    {errors.map((error, index) => (
                        <Box key={index} flexDirection="column" marginLeft={2} marginBottom={0}>
                            <Text color="red">
                                {index + 1}. [{error.path}] {error.message}
                            </Text>
                            {error.value !== undefined && (
                                <Text color="gray" dimColor>
                                    {" "}
                                    值: {JSON.stringify(error.value)}
                                </Text>
                            )}
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
};
