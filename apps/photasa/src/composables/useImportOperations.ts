import type { IImportOperations } from "@renderer/interfaces/fang-xuan-ling.interface";
import { useFangXuanLing } from "./useFangXuanLing";

export function useImportOperations(): IImportOperations {
    return useFangXuanLing().imports;
}
