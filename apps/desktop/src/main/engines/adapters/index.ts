// Electron 专用适配器（依赖 Menu/IPC 等）
import "./BuiltinAdapter";
import "./TaibaijinxingAdapter";

// 引擎包内适配器（@Adapter 装饰器在包入口侧效注册）
import "@photasa/wenchang";
import "@photasa/qianliyan";
import "@photasa/siming";
