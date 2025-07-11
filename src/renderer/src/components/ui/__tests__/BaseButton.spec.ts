import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseButton from '../BaseButton.vue'

describe('BaseButton', () => {
    it('renders with default props', () => {
        const wrapper = mount(BaseButton, {
            slots: {
                default: 'Click me'
            }
        })
        
        expect(wrapper.text()).toBe('Click me')
        expect(wrapper.classes()).toContain('inline-flex')
        expect(wrapper.element.tagName).toBe('BUTTON')
    })

    it('applies variant classes correctly', () => {
        const wrapper = mount(BaseButton, {
            props: {
                variant: 'danger'
            },
            slots: {
                default: 'Delete'
            }
        })
        
        expect(wrapper.classes()).toContain('bg-[var(--color-danger)]')
    })

    it('applies size classes correctly', () => {
        const wrapper = mount(BaseButton, {
            props: {
                size: 'lg'
            },
            slots: {
                default: 'Large Button'
            }
        })
        
        expect(wrapper.classes()).toContain('px-6')
        expect(wrapper.classes()).toContain('py-3')
    })

    it('emits click event when clicked', async () => {
        const wrapper = mount(BaseButton, {
            slots: {
                default: 'Click me'
            }
        })
        
        await wrapper.trigger('click')
        expect(wrapper.emitted('click')).toBeTruthy()
    })

    it('disables the button when disabled prop is true', () => {
        const wrapper = mount(BaseButton, {
            props: {
                disabled: true
            },
            slots: {
                default: 'Disabled'
            }
        })
        
        expect(wrapper.attributes('disabled')).toBeDefined()
        expect(wrapper.classes()).toContain('disabled:opacity-50')
    })
})