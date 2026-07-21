<template>
    <div class="p-8">
        <h1 class="text-2xl font-bold mb-6">BaseModal 动画演示</h1>

        <div class="space-y-4">
            <BaseButton @click="showModal = true" variant="primary"> 打开模态框 </BaseButton>

            <BaseButton @click="showModal2 = true" variant="secondary"> 打开大模态框 </BaseButton>

            <BaseButton @click="showModal3 = true" variant="outline"> 打开自定义模态框 </BaseButton>
        </div>

        <!-- 基础模态框 -->
        <BaseModal :open="showModal" title="基础模态框" @close="showModal = false">
            <p class="text-gray-600 mb-4">
                这是一个带有动画效果的基础模态框。点击背景或按ESC键可以关闭。
            </p>
            <p class="text-sm text-gray-500">
                注意观察打开和关闭时的动画效果：
                <br />• 背景遮罩淡入淡出 <br />• 内容区域缩放+淡入淡出 <br />•
                使用cubic-bezier缓动函数
            </p>
        </BaseModal>

        <!-- 大模态框 -->
        <BaseModal :open="showModal2" title="大模态框演示" size="xl" @close="showModal2 = false">
            <div class="space-y-4">
                <h3 class="text-lg font-semibold">动画特性</h3>
                <ul class="list-disc list-inside space-y-2 text-gray-600">
                    <li>背景遮罩独立淡入淡出动画</li>
                    <li>内容区域缩放+位移动画</li>
                    <li>进入动画：从0.9倍缩放+向上20px位移开始</li>
                    <li>离开动画：缩放到0.95倍+向下10px位移</li>
                    <li>移动端优化的动画时长和效果</li>
                </ul>

                <div class="bg-blue-50 p-4 rounded-lg">
                    <h4 class="font-medium text-blue-900">技术实现</h4>
                    <p class="text-blue-700 text-sm mt-2">
                        使用Vue 3的Transition组件，配合CSS3的transform和opacity属性，
                        实现流畅的60fps动画效果。
                    </p>
                </div>
            </div>
        </BaseModal>

        <!-- 自定义模态框 -->
        <BaseModal
            :open="showModal3"
            title="自定义样式模态框"
            size="custom"
            :style="{ '--modal-width': '600px' }"
            @close="showModal3 = false"
        >
            <div class="text-center">
                <div
                    class="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full mx-auto mb-4 flex items-center justify-center"
                >
                    <span class="text-white text-2xl">✨</span>
                </div>
                <h3 class="text-xl font-semibold mb-2">动画效果展示</h3>
                <p class="text-gray-600 mb-6">这个模态框展示了自定义宽度和样式的动画效果。</p>

                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div class="bg-gray-50 p-3 rounded">
                        <div class="font-medium">进入动画</div>
                        <div class="text-gray-600">0.3s ease-out</div>
                    </div>
                    <div class="bg-gray-50 p-3 rounded">
                        <div class="font-medium">离开动画</div>
                        <div class="text-gray-600">0.2s ease-in</div>
                    </div>
                </div>
            </div>
        </BaseModal>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import BaseModal from "./BaseModal.vue";
import BaseButton from "./BaseButton.vue";

const showModal = ref(false);
const showModal2 = ref(false);
const showModal3 = ref(false);
</script>

<style scoped>
/* 演示页面样式 */
.space-y-4 > * + * {
    margin-top: 1rem;
}

.space-y-2 > * + * {
    margin-top: 0.5rem;
}

.list-disc {
    list-style-type: disc;
}

.list-inside {
    list-style-position: inside;
}
</style>
