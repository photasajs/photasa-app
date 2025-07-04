/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class",
    // Tailwind v3+ 推荐写法，原 purge 改为 content
    content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
    theme: {
        extend: {},
    },
    plugins: [],
};
