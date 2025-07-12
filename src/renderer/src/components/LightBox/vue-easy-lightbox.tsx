import {
    defineComponent,
    PropType,
    nextTick,
    computed,
    ref,
    reactive,
    watch,
    onMounted,
    onBeforeUnmount,
    Transition,
    withModifiers,
    TeleportProps,
    Teleport,
    shallowReactive,
} from "vue";

import { SvgIcon } from "./components/svg-icon";
import { Toolbar } from "./components/toolbar";
import { ImgLoading } from "./components/img-loading";
import { ImgOnError } from "./components/img-on-error";
import { ImgTitle } from "./components/img-title";
import { DefaultIcons } from "./components/default-icons";

import { prefixCls } from "./constant";
import {
    on,
    off,
    calculateNextIndex,
    calculatePrevIndex,
    calculateCursor,
    calculateZoomScale,
    normalizeRotation,
    shouldHandleWheel,
    getKeyboardAction,
    canMoveImage,
    shouldShowNavigationBtn,
    calculateMouseDelta,
    validateIndex,
} from "./utils/index";
import { useImage, useMouse, useTouch } from "./utils/hooks";
import { Img, IImgWrapperState, PropsImgs } from "./types";
import { isImg, mutateDragging, zoom } from "./vue-easy-lightbox.utils";
import { isString } from "@renderer/common/string";
import { notEmpty } from "@renderer/common/object";
import { isArray } from "@renderer/common/array";
import { preventDefault } from "@renderer/common/event";

/**
 * 图片预览组件
 *
 * 采用jsx语法，使用vue3的组合式api
 */
export default defineComponent({
    name: "VueEasyLightbox", // 组件名称
    props: {
        imgs: {
            type: [Array, String] as PropType<PropsImgs>,
            default: () => "",
        },
        visible: {
            type: Boolean,
            default: false,
        },
        index: {
            type: Number,
            default: 0,
        },
        scrollDisabled: {
            type: Boolean,
            default: true,
        },
        escDisabled: {
            type: Boolean,
            default: false,
        },
        moveDisabled: {
            type: Boolean,
            default: false,
        },
        titleDisabled: {
            type: Boolean,
            default: false,
        },
        maskClosable: {
            type: Boolean,
            default: true,
        },
        teleport: {
            type: [String, Object] as PropType<TeleportProps["to"]>,
            default: null,
        },
        swipeTolerance: {
            type: Number,
            default: 50,
        },
        loop: {
            type: Boolean,
            default: false,
        },
        rtl: {
            type: Boolean,
            default: false,
        },
        zoomScale: {
            type: Number,
            default: 0.12,
        },
        maxZoom: {
            type: Number,
            default: 3,
        },
        minZoom: {
            type: Number,
            default: 0.1,
        },
        rotateDisabled: {
            type: Boolean,
            default: false,
        },
        zoomDisabled: {
            type: Boolean,
            default: false,
        },
        pinchDisabled: {
            type: Boolean,
            default: false,
        },
        dblclickDisabled: {
            type: Boolean,
            default: false,
        },
    },
    /**
     * 组件事件
     */
    emits: {
        hide: () => true,
        /* eslint-disable @typescript-eslint/no-unused-vars */
        "on-error": (_e: Event) => true,
        "on-prev": (_oldIndex: number, _newIndex: number) => true,
        "on-next": (_oldIndex: number, _newIndex: number) => true,
        "on-prev-click": (_oldIndex: number, _newIndex: number) => true,
        "on-next-click": (_oldIndex: number, _newIndex: number) => true,
        "on-index-change": (_oldIndex: number, _newIndex: number) => true,
        "on-rotate": (_deg: number) => true,
        /* eslint-enable @typescript-eslint/no-unused-vars */
    },

    /**
     * 组件逻辑
     * @param props 组件属性
     * @param emit 事件发射器
     * @param slots 插槽
     * @returns 组件
     */
    setup(props, { emit, slots }) {
        const { imgRef, imgState, setImgSize } = useImage();
        const imgIndex = ref(props.index);
        const lastBodyStyleOverflowY = ref("");
        /**
         * 图片包裹状态
         */
        // 用 shallowReactive 替换 reactive，提升性能
        const imgWrapperState = shallowReactive<IImgWrapperState>({
            scale: 1,
            lastScale: 1,
            rotateDeg: 0,
            top: 0,
            left: 0,
            initX: 0,
            initY: 0,
            lastX: 0,
            lastY: 0,
            touches: [] as TouchList | [],
        });
        /**
         * 图片状态
         */
        const status = reactive({
            loadError: false,
            loading: false,
            dragging: false,
            gesturing: false,
            wheeling: false,
        });

        const imgList = computed(() => {
            if (isArray(props.imgs)) {
                return props.imgs
                    .map((img: string | Img | null) => {
                        if (typeof img === "string") {
                            return { src: img };
                        } else if (img && isImg(img)) {
                            return img;
                        }
                        return null;
                    })
                    .filter(notEmpty);
            } else if (isString(props.imgs)) {
                return [{ src: props.imgs }];
            }
            return [];
        });

        const currentImg = computed(() => imgList.value[imgIndex.value]);
        const currentImgSrc = computed(() => {
            return imgList.value[imgIndex.value]?.src;
        });
        const currentImgTitle = computed(() => {
            return imgList.value[imgIndex.value]?.title;
        });
        const currentImgAlt = computed(() => {
            return imgList.value[imgIndex.value]?.alt;
        });

        const currCursor = () => {
            return calculateCursor(status.loadError, props.moveDisabled, status.dragging);
        };

        const imgWrapperStyle = computed(() => {
            const s = imgWrapperState;
            return {
                cursor: currCursor(),
                top: `50%`,
                left: `50%`,
                transition: status.dragging || status.gesturing ? "none" : "",
                transform: `translate(-50%, -50%) translate(${s.left}px, ${s.top}px) scale(${s.scale}) rotate(${s.rotateDeg}deg)`,
            };
        });

        const closeModal = () => {
            emit("hide");
        };

        const initImg = () => {
            imgWrapperState.scale = 1;
            imgWrapperState.lastScale = 1;
            imgWrapperState.rotateDeg = 0;
            imgWrapperState.top = 0;
            imgWrapperState.left = 0;
            status.loadError = false;
            status.dragging = false;
            // 如果有default slot，则slot内容自己管理加载状态，不需要显示loading
            // 只有使用内置img时才需要loading状态
            status.loading = !slots.default;
        };

        // switching imgs manually
        const changeIndex = (
            newIndex: number,
            emitsCallback?: (oldIdx: number, newIdx: number) => void,
        ) => {
            const oldIndex = imgIndex.value;

            initImg();

            imgIndex.value = newIndex;

            // handle same Img
            if (imgList.value[imgIndex.value] === imgList.value[newIndex]) {
                nextTick(() => {
                    status.loading = false;
                });
            }

            // No emit event when hidden or same index
            if (!props.visible || oldIndex === newIndex) return;

            emitsCallback?.(oldIndex, newIndex);

            emit("on-index-change", oldIndex, newIndex);
        };

        const onNext = () => {
            const oldIndex = imgIndex.value;
            const newIndex = calculateNextIndex(oldIndex, imgList.value.length, props.loop);

            if (newIndex === null) return;

            changeIndex(newIndex, (oldIdx, newIdx) => {
                emit("on-next", oldIdx, newIdx);
                emit("on-next-click", oldIdx, newIdx);
            });
        };

        const onPrev = () => {
            const oldIndex = imgIndex.value;
            const newIndex = calculatePrevIndex(oldIndex, imgList.value.length, props.loop);

            if (newIndex === null) return;

            changeIndex(newIndex, (oldIdx, newIdx) => {
                emit("on-prev", oldIdx, newIdx);
                emit("on-prev-click", oldIdx, newIdx);
            });
        };

        const zoomIn = () => {
            const newScale = calculateZoomScale(
                imgWrapperState.scale,
                props.zoomScale,
                "in",
                props.maxZoom,
                props.minZoom,
                imgState.maxScale,
            );
            if (newScale !== null) {
                zoom(newScale, imgState, imgWrapperState);
            }
        };

        const zoomOut = () => {
            const newScale = calculateZoomScale(
                imgWrapperState.scale,
                props.zoomScale,
                "out",
                props.maxZoom,
                props.minZoom,
                imgState.maxScale,
            );
            if (newScale !== null) {
                zoom(newScale, imgState, imgWrapperState);
            }
        };

        const emitRotate = () => {
            const normalizedDeg = normalizeRotation(imgWrapperState.rotateDeg);
            emit("on-rotate", normalizedDeg);
        };

        const rotateLeft = () => {
            imgWrapperState.rotateDeg -= 90;
            emitRotate();
        };

        const rotateRight = () => {
            imgWrapperState.rotateDeg += 90;
            emitRotate();
        };

        const resize = () => {
            imgWrapperState.scale = 1;
            imgWrapperState.top = 0;
            imgWrapperState.left = 0;
        };

        // check img moveable
        const canMove = (button = 0) => {
            return canMoveImage(props.moveDisabled, button);
        };

        // mouse
        const { onMouseDown, onMouseMove, onMouseUp } = useMouse(imgWrapperState, status, canMove);
        const { onTouchStart, onTouchMove, onTouchEnd } = useTouch(
            imgState,
            imgWrapperState,
            status,
            canMove,
            () => !props.pinchDisabled,
        );

        const onDblclick = () => {
            if (props.dblclickDisabled) return;
            if (imgWrapperState.scale !== imgState.maxScale) {
                imgWrapperState.lastScale = imgWrapperState.scale;
                imgWrapperState.scale = imgState.maxScale;
            } else {
                imgWrapperState.scale = imgWrapperState.lastScale;
            }
        };

        const onWheel = (e: WheelEvent) => {
            if (!shouldHandleWheel(status, props.scrollDisabled, props.zoomDisabled)) {
                return;
            }

            status.wheeling = true;

            setTimeout(() => {
                status.wheeling = false;
            }, 80);

            if (e.deltaY < 0) {
                zoomIn();
            } else {
                zoomOut();
            }
        };

        // key press events handler
        const onKeyPress = (e: Event) => {
            const evt = e as KeyboardEvent;

            if (!props.visible) return;

            const action = getKeyboardAction(evt.key, props.rtl, props.escDisabled);

            switch (action) {
                case "close":
                    closeModal();
                    break;
                case "prev":
                    onPrev();
                    break;
                case "next":
                    onNext();
                    break;
            }
        };

        const onMaskClick = () => {
            if (props.maskClosable) {
                closeModal();
            }
        };

        // handle loading process
        const onImgLoad = () => {
            setImgSize();
            // 确保当实际图片加载完成后清除loading状态，作为test image的备用机制
            // 这样即使隐藏的test image因为imgRef时序问题没有触发onTestImgLoad，也能正确清除loading状态
            status.loading = false;
        };

        const onTestImgLoad = () => {
            status.loading = false;
        };

        const onTestImgError = (e: Event) => {
            status.loading = false;
            status.loadError = true;
            emit("on-error", e);
        };

        const onWindowResize = () => {
            if (!props.visible) return;
            setImgSize();
        };

        watch(
            () => props.index,
            (newIndex) => {
                if (newIndex < 0 || newIndex >= imgList.value.length) {
                    return;
                }
                changeIndex(newIndex);
            },
        );

        watch(
            () => status.dragging,
            (newStatus, oldStatus) => {
                mutateDragging(newStatus, oldStatus, {
                    onNext,
                    onPrev,
                    canMove,
                    imgWrapperState,
                    swipeTolerance: props.swipeTolerance,
                });
            },
        );

        // init
        watch(
            () => props.visible,
            (visible) => {
                if (visible) {
                    initImg();
                    const len = imgList.value.length;
                    if (len === 0) {
                        imgIndex.value = 0;
                        status.loading = false;
                        nextTick(() => (status.loadError = true));
                        return;
                    }
                    imgIndex.value = validateIndex(props.index, len);

                    if (props.scrollDisabled) {
                        disableScrolling();
                    }
                } else {
                    // 当lightbox关闭时，清理所有状态，避免下次打开时显示上次的状态
                    status.loading = false;
                    status.loadError = false;
                    status.dragging = false;
                    status.gesturing = false;
                    status.wheeling = false;

                    if (props.scrollDisabled) {
                        enableScrolling();
                    }
                }
            },
        );

        const disableScrolling = () => {
            if (!document) {
                return;
            }
            lastBodyStyleOverflowY.value = document.body.style.overflowY;
            document.body.style.overflowY = "hidden";
        };

        const enableScrolling = () => {
            if (!document) {
                return;
            }
            document.body.style.overflowY = lastBodyStyleOverflowY.value;
        };

        onMounted(() => {
            on(document, "keydown", onKeyPress);
            on(window, "resize", onWindowResize);
        });

        onBeforeUnmount(() => {
            off(document, "keydown", onKeyPress);
            off(window, "resize", onWindowResize);
            if (props.scrollDisabled) {
                enableScrolling();
            }
        });

        const renderLoading = () => {
            return typeof slots.loading === "function" ? (
                slots.loading({
                    key: "loading",
                })
            ) : (
                <ImgLoading key="img-loading" />
            );
        };
        const renderOnError = () => {
            return typeof slots.onerror === "function" ? (
                slots.onerror({
                    key: "onerror",
                })
            ) : (
                <ImgOnError key="img-on-error" />
            );
        };

        // 拖拽相关状态
        const dragging = ref(false);
        const lastPos = ref({ x: 0, y: 0 });
        // 鼠标按下
        const onWrapperMouseDown = (e: MouseEvent) => {
            if (imgWrapperState.scale <= 1 || e.button !== 0) return;
            dragging.value = true;
            lastPos.value = { x: e.clientX, y: e.clientY };
            window.addEventListener("mousemove", onWrapperMouseMove);
            window.addEventListener("mouseup", onWrapperMouseUp);
        };
        // 鼠标移动
        const onWrapperMouseMove = (e: MouseEvent) => {
            if (!dragging.value) return;
            const currentPos = { x: e.clientX, y: e.clientY };
            const { dx, dy } = calculateMouseDelta(currentPos, lastPos.value);
            imgWrapperState.left += dx;
            imgWrapperState.top += dy;
            lastPos.value = currentPos;
        };
        // 鼠标松开
        const onWrapperMouseUp = () => {
            dragging.value = false;
            window.removeEventListener("mousemove", onWrapperMouseMove);
            window.removeEventListener("mouseup", onWrapperMouseUp);
        };

        const renderImgWrapper = () => {
            if (typeof slots.default === "function") {
                let slotVNode = slots.default({ currentImg: currentImg.value });
                if (Array.isArray(slotVNode) && slotVNode.length > 1) {
                    slotVNode = [<div>{slotVNode}</div>];
                }
                if (slotVNode && slotVNode.length > 0) {
                    const vnode = slotVNode[0];
                    if (vnode.type === "img" || (vnode.props && vnode.props.src)) {
                        vnode.props = {
                            ...vnode.props,
                            draggable: false,
                            onDragstart: (e) => e.preventDefault(),
                        };
                    }
                    return (
                        <div
                            class={`${prefixCls}-img-wrapper`}
                            style={imgWrapperStyle.value}
                            key="img-wrapper"
                            onMousedown={onWrapperMouseDown}
                            onDragstart={(e) => e.preventDefault()}
                        >
                            {vnode}
                        </div>
                    );
                }
            }
            return (
                <div
                    class={`${prefixCls}-img-wrapper`}
                    style={imgWrapperStyle.value}
                    key="img-wrapper"
                    onMousedown={onWrapperMouseDown}
                    onDragstart={(e) => e.preventDefault()}
                >
                    {/* 优化：如果有 default slot 则只渲染 slot，否则渲染 <img> */}
                    {slots.default ? (
                        <div
                            class={`${prefixCls}-default-slot`}
                            onDragstart={(e) => e.preventDefault()}
                        >
                            {slots.default({ currentImg: currentImg.value })}
                        </div>
                    ) : (
                        <img
                            alt={currentImgAlt.value}
                            ref={imgRef}
                            draggable="false"
                            class={`${prefixCls}-img`}
                            src={currentImgSrc.value}
                            onMousedown={onMouseDown}
                            onMouseup={onMouseUp}
                            onMousemove={onMouseMove}
                            onTouchstart={onTouchStart}
                            onTouchmove={onTouchMove}
                            onTouchend={onTouchEnd}
                            onLoad={onImgLoad}
                            onDblclick={onDblclick}
                            onDragstart={(e) => e.preventDefault()}
                        />
                    )}
                </div>
            );
        };

        const renderWrapper = () => {
            // Vue的Transition组件需要其子元素具有唯一的key属性来正确执行动画过渡
            // 当状态改变时(loading -> error -> image)，Vue通过key来识别哪些元素需要被创建、更新或销毁
            // 没有key时，Vue会尝试复用元素，导致getTransitionRawChildren函数访问null元素的key属性而报错
            if (status.loading) {
                // 加载状态：显示加载指示器，使用loading-state作为key标识
                return <div key="loading-state">{renderLoading()}</div>;
            } else if (status.loadError) {
                // 错误状态：显示错误信息，使用error-state作为key标识
                return <div key="error-state">{renderOnError()}</div>;
            }
            // 正常状态：显示图片内容，使用image-state作为key标识
            return <div key="image-state">{renderImgWrapper()}</div>;
        };

        // 测试图片，用于预加载图片
        // 只有在没有default slot且imgRef.value存在时才需要预加载图片
        // 如果有default slot，则slot内容自己管理加载状态，不需要test image
        const renderTestImg = () => {
            if (!slots.default && imgRef.value) {
                return (
                    <img
                        style="display:none;"
                        src={currentImgSrc.value}
                        onError={onTestImgError}
                        onLoad={onTestImgLoad}
                    />
                );
            }
            return null;
        };

        const renderPrevBtn = () => {
            if (typeof slots["prev-btn"] === "function") {
                return slots["prev-btn"]({
                    prev: onPrev,
                });
            }

            const btnState = shouldShowNavigationBtn(
                imgList.value.length,
                imgIndex.value,
                props.loop,
                "prev",
            );

            if (!btnState.show) return;

            return (
                <div
                    role="button"
                    aria-label="previous image button"
                    class={`btn__prev ${btnState.disabled ? "disable" : ""}`}
                    onClick={onPrev}
                >
                    {props.rtl ? <SvgIcon type="next" /> : <SvgIcon type="prev" />}
                </div>
            );
        };

        const renderNextBtn = () => {
            if (typeof slots["next-btn"] === "function") {
                return slots["next-btn"]({
                    next: onNext,
                });
            }

            const btnState = shouldShowNavigationBtn(
                imgList.value.length,
                imgIndex.value,
                props.loop,
                "next",
            );

            if (!btnState.show) return;

            return (
                <div
                    role="button"
                    aria-label="next image button"
                    class={`btn__next ${btnState.disabled ? "disable" : ""}`}
                    onClick={onNext}
                >
                    {props.rtl ? <SvgIcon type="prev" /> : <SvgIcon type="next" />}
                </div>
            );
        };

        const renderCloseBtn = () => {
            return typeof slots["close-btn"] === "function" ? (
                slots["close-btn"]({
                    close: closeModal,
                })
            ) : (
                <div
                    role="button"
                    aria-label="close image preview button"
                    class={`btn__close`}
                    onClick={closeModal}
                >
                    <SvgIcon type="close" />
                </div>
            );
        };

        const renderToolbar = () => {
            return typeof slots.toolbar === "function" ? (
                slots.toolbar({
                    toolbarMethods: {
                        zoomIn,
                        zoomOut,
                        rotate: rotateLeft,
                        rotateLeft,
                        rotateRight,
                        resize,
                    },
                    zoomIn,
                    zoomOut,
                    rotate: rotateLeft,
                    rotateLeft,
                    rotateRight,
                    resize,
                })
            ) : (
                <Toolbar
                    zoomIn={zoomIn}
                    zoomOut={zoomOut}
                    resize={resize}
                    rotateLeft={rotateLeft}
                    rotateRight={rotateRight}
                    rotateDisabled={props.rotateDisabled}
                    zoomDisabled={props.zoomDisabled}
                />
            );
        };
        const renderImgTitle = () => {
            if (props.titleDisabled || status.loading || status.loadError) {
                return;
            }

            if (typeof slots.title === "function") {
                return slots.title({
                    currentImg: currentImg.value,
                });
            }

            if (currentImgTitle.value) {
                return <ImgTitle>{currentImgTitle.value}</ImgTitle>;
            }

            return;
        };

        const renderModal = () => {
            if (!props.visible) {
                return;
            }

            return (
                <div
                    onTouchmove={preventDefault}
                    class={[`${prefixCls}-modal`, props.rtl ? "is-rtl" : ""]}
                    onClick={withModifiers(onMaskClick, ["self"])}
                    onWheel={onWheel}
                >
                    <DefaultIcons />
                    <Transition name={`${prefixCls}-fade`} mode="out-in">
                        {renderWrapper()}
                    </Transition>
                    {renderTestImg()}
                    <div class={`${prefixCls}-btns-wrapper`}>
                        {renderPrevBtn()}
                        {renderNextBtn()}
                        {renderImgTitle()}
                        {renderCloseBtn()}
                        {renderToolbar()}
                    </div>
                </div>
            );
        };

        return () => {
            if (props.teleport) {
                return (
                    <Teleport to={props.teleport}>
                        <Transition name={`${prefixCls}-fade`}>{renderModal()}</Transition>
                    </Teleport>
                );
            }

            return <Transition name={`${prefixCls}-fade`}>{renderModal()}</Transition>;
        };
    },
});
