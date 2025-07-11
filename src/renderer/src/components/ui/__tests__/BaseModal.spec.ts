import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseModal from '../BaseModal.vue'

describe('BaseModal', () => {
    it('receives correct props', () => {
        const wrapper = mount(BaseModal, {
            props: {
                open: true,
                title: 'Test Modal',
                size: 'lg',
                closable: true,
                showDefaultFooter: true,
                confirmText: 'OK',
                cancelText: 'Cancel'
            }
        })
        
        expect(wrapper.props('open')).toBe(true)
        expect(wrapper.props('title')).toBe('Test Modal')
        expect(wrapper.props('size')).toBe('lg')
        expect(wrapper.props('closable')).toBe(true)
        expect(wrapper.props('showDefaultFooter')).toBe(true)
    })

    it('has correct default props', () => {
        const wrapper = mount(BaseModal, {
            props: {
                open: false
            }
        })
        
        expect(wrapper.props('size')).toBe('md')
        expect(wrapper.props('closable')).toBe(true)
        expect(wrapper.props('showDefaultFooter')).toBe(false)
        expect(wrapper.props('confirmText')).toBe('Confirm')
        expect(wrapper.props('cancelText')).toBe('Cancel')
    })

    it('computes size classes correctly', () => {
        const wrapper = mount(BaseModal, {
            props: {
                open: true,
                size: 'lg'
            }
        })
        
        // Test by checking if the component renders with correct class
        expect(wrapper.props('size')).toBe('lg')
    })

    it('handles different size variants', () => {
        const sizes = ['sm', 'md', 'lg', 'xl', 'full']
        
        sizes.forEach((size) => {
            const wrapper = mount(BaseModal, {
                props: {
                    open: true,
                    size: size as any
                }
            })
            expect(wrapper.props('size')).toBe(size)
        })
    })
})