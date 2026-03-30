//! zouwu-builtin — 内置适配器
//!
//! 实现工作流引擎的内置操作，通过标准 Adapter trait 注册到引擎。
//! 内置操作由引擎的 BuiltinStep 直接处理，此 crate 提供的 BuiltinAdapter
//! 是可选的外部注册方式，使 builtin 操作也可通过 action 步骤调用。

mod builtin_adapter;

pub use builtin_adapter::BuiltinAdapter;
