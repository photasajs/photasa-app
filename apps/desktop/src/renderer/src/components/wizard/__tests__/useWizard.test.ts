/**
 * Unit tests for useWizard composable
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useWizard } from "../composables/useWizard";
import type { WizardConfig } from "../types";

describe("useWizard", () => {
    let mockConfig: WizardConfig;
    let mockValidationFn: ReturnType<typeof vi.fn>;
    let mockOnEnterFn: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockValidationFn = vi.fn();
        mockOnEnterFn = vi.fn();

        mockConfig = {
            steps: [
                {
                    id: "step1",
                    title: "Step 1",
                    isValid: mockValidationFn,
                    onEnter: mockOnEnterFn,
                },
                {
                    id: "step2",
                    title: "Step 2",
                    isValid: vi.fn(() => true),
                },
            ],
        };
    });

    describe("Step Validation", () => {
        it("should call validation function with step data", () => {
            const wizard = useWizard(mockConfig);

            // Set some step data
            wizard.setStepData("step1", { sourcePaths: ["/test/path"], targetPath: "/target" });

            // Mock validation to return true
            mockValidationFn.mockReturnValue(true);

            // Check if we can go next (access .value to trigger computed)
            const canGoNext = wizard.canGoNext.value;

            expect(mockValidationFn).toHaveBeenCalledWith({
                sourcePaths: ["/test/path"],
                targetPath: "/target",
            });
            expect(canGoNext).toBe(true);
        });

        it("should prevent navigation when validation fails", () => {
            const wizard = useWizard(mockConfig);

            // Set invalid step data
            wizard.setStepData("step1", { sourcePaths: [], targetPath: "" });

            // Mock validation to return false
            mockValidationFn.mockReturnValue(false);

            // Check if we can go next (access .value to trigger computed)
            const canGoNext = wizard.canGoNext.value;

            expect(mockValidationFn).toHaveBeenCalledWith({
                sourcePaths: [],
                targetPath: "",
            });
            expect(canGoNext).toBe(false);
        });

        it("should allow navigation when validation passes", () => {
            const wizard = useWizard(mockConfig);

            // Set valid step data
            wizard.setStepData("step1", { sourcePaths: ["/test"], targetPath: "/target" });

            // Mock validation to return true
            mockValidationFn.mockReturnValue(true);

            // Check if we can go next (access .value to trigger computed)
            const canGoNext = wizard.canGoNext.value;

            expect(canGoNext).toBe(true);
        });

        it("should handle undefined step data gracefully", () => {
            const wizard = useWizard(mockConfig);

            // Don't set any step data (undefined)
            mockValidationFn.mockReturnValue(false);

            // Check if we can go next (access .value to trigger computed)
            const canGoNext = wizard.canGoNext.value;

            expect(mockValidationFn).toHaveBeenCalledWith(undefined);
            expect(canGoNext).toBe(false);
        });
    });

    describe("Step Navigation", () => {
        it("should call onEnter with step data when entering a step", async () => {
            const wizard = useWizard(mockConfig);

            // Set step data
            wizard.setStepData("step1", { test: "data" });

            // Initialize wizard (should call onEnter for first step)
            wizard.initialize();

            expect(mockOnEnterFn).toHaveBeenCalledWith({ test: "data" });
        });

        it("should call onEnter with undefined when no step data exists", async () => {
            const wizard = useWizard(mockConfig);

            // Initialize without setting step data
            wizard.initialize();

            expect(mockOnEnterFn).toHaveBeenCalledWith(undefined);
        });

        it("should validate current step before allowing navigation", async () => {
            const wizard = useWizard(mockConfig);

            // Set step data
            wizard.setStepData("step1", { sourcePaths: ["/test"], targetPath: "/target" });

            // Mock validation to return true
            mockValidationFn.mockReturnValue(true);

            // Try to go to next step
            const success = await wizard.goNext();

            expect(mockValidationFn).toHaveBeenCalledWith({
                sourcePaths: ["/test"],
                targetPath: "/target",
            });
            expect(success).toBe(true);
            expect(wizard.currentStepIndex.value).toBe(1);
        });

        it("should prevent navigation when validation fails", async () => {
            const wizard = useWizard(mockConfig);

            // Set invalid step data
            wizard.setStepData("step1", { sourcePaths: [], targetPath: "" });

            // Mock validation to return false
            mockValidationFn.mockReturnValue(false);

            // Try to go to next step
            const success = await wizard.goNext();

            expect(success).toBe(false);
            expect(wizard.currentStepIndex.value).toBe(0); // Should stay on current step
        });
    });

    describe("Step Data Management", () => {
        it("should store and retrieve step data correctly", () => {
            const wizard = useWizard(mockConfig);

            const testData = { sourcePaths: ["/test1", "/test2"], targetPath: "/target" };

            // Set step data
            wizard.setStepData("step1", testData);

            // Get step data
            const retrievedData = wizard.getStepData("step1");

            expect(retrievedData).toEqual(testData);
        });

        it("should return undefined for non-existent step data", () => {
            const wizard = useWizard(mockConfig);

            const retrievedData = wizard.getStepData("nonexistent");

            expect(retrievedData).toBeUndefined();
        });

        it("should update step data correctly", () => {
            const wizard = useWizard(mockConfig);

            // Set initial data
            wizard.setStepData("step1", { sourcePaths: ["/test1"] });

            // Update data
            wizard.setStepData("step1", {
                sourcePaths: ["/test1", "/test2"],
                targetPath: "/target",
            });

            const retrievedData = wizard.getStepData("step1");

            expect(retrievedData).toEqual({
                sourcePaths: ["/test1", "/test2"],
                targetPath: "/target",
            });
        });
    });

    describe("Async Validation", () => {
        it("should handle async validation functions", async () => {
            const asyncValidationFn = vi.fn().mockResolvedValue(true);

            const configWithAsync: WizardConfig = {
                steps: [
                    {
                        id: "async-step",
                        title: "Async Step",
                        isValid: asyncValidationFn,
                    },
                ],
            };

            const wizard = useWizard(configWithAsync);
            wizard.setStepData("async-step", { test: "data" });

            // For async validation, canGoNext should return false (as per current implementation)
            // but validateCurrentStep should handle the async case
            const isValid = await wizard.validateCurrentStep();

            expect(asyncValidationFn).toHaveBeenCalledWith({ test: "data" });
            expect(isValid).toBe(true);
        });

        it("should handle rejected async validation", async () => {
            const asyncValidationFn = vi.fn().mockResolvedValue(false);

            const configWithAsync: WizardConfig = {
                steps: [
                    {
                        id: "async-step",
                        title: "Async Step",
                        isValid: asyncValidationFn,
                    },
                ],
            };

            const wizard = useWizard(configWithAsync);
            wizard.setStepData("async-step", { test: "data" });

            const isValid = await wizard.validateCurrentStep();

            expect(isValid).toBe(false);
        });
    });

    describe("Edge Cases", () => {
        it("should handle steps without validation functions", () => {
            const configWithoutValidation: WizardConfig = {
                steps: [
                    {
                        id: "no-validation",
                        title: "No Validation Step",
                        // No isValid function
                    },
                ],
            };

            const wizard = useWizard(configWithoutValidation);

            // Should default to true when no validation function
            expect(wizard.canGoNext.value).toBe(true);
        });

        it("should handle empty step data", () => {
            const wizard = useWizard(mockConfig);

            // Set empty object as step data
            wizard.setStepData("step1", {});

            mockValidationFn.mockReturnValue(false);

            const canGoNext = wizard.canGoNext.value;

            expect(mockValidationFn).toHaveBeenCalledWith({});
            expect(canGoNext).toBe(false);
        });

        it("should handle null step data", () => {
            const wizard = useWizard(mockConfig);

            // Set null as step data
            wizard.setStepData("step1", null);

            mockValidationFn.mockReturnValue(false);

            const canGoNext = wizard.canGoNext.value;

            expect(mockValidationFn).toHaveBeenCalledWith(null);
            expect(canGoNext).toBe(false);
        });
    });
});
