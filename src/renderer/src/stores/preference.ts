// stores/photos.js
import { defineStore } from "pinia";

const DEFAULT_DESKTOP_PATH = "/Users/albert.li/Desktop/";

type PreferenceState = {
    paths: string[];
};

export const usePreferenceStore = defineStore("preference", {
    state: (): PreferenceState => {
        const paths = [DEFAULT_DESKTOP_PATH];
        return {
            paths,
        };
    },
    persist: true,
    actions: {
        addPath(path) {
            if (this.paths.indexOf(path) < 0) {
                this.paths.push(path);
                this.paths = this.paths.sort();
            }
        },
    },
});
