<script setup lang="ts">
import Versions from './components/Versions.vue'
</script>

<template>
  <v-card>
    <v-layout>
      <v-navigation-drawer>
        <v-list>
          <v-list-item title="Navigation drawer"></v-list-item>
        </v-list>
      </v-navigation-drawer>

      <v-app-bar title="Application bar"></v-app-bar>

      <v-main style="min-height: 300px;">
        <Versions></Versions>
      </v-main>
    </v-layout>
  </v-card>
</template>

<style lang="less">
@import './assets/css/styles.less';
</style>
