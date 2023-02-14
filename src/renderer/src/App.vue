<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<script setup lang="ts">
import treeview from 'vue3-treeview'
import { reactive, toRefs, toRef } from 'vue'
import 'vue3-treeview/dist/style.css'

interface Node {
  text: string
  children?: string[]
  state: {
    isLoading: boolean
  }
}

interface Config {
  roots: string[]
  leaves: string[]
}

interface Nodes {
  [key: string]: Node
}

const config = reactive<Config>({
  roots: ['id1', 'id2'],
  leaves: ['fakeid']
})

const nodes = reactive<Nodes>({
  id1: {
    text: 'text1',
    children: ['id11', 'id12'],
    state: {
      isLoading: false
    }
  },
  id11: {
    text: 'text11',
    state: {
      isLoading: false
    }
  },
  id12: {
    text: 'text12',
    state: {
      isLoading: false
    }
  },
  id2: {
    text: 'text2',
    state: {
      isLoading: false
    }
  }
})

const context = toRefs({
  config,
  nodes
})

function addServerNode(n: Node): void {
  if (n.children && n.children.length > 0) return

  // set node loading state to tree
  n.state.isLoading = true

  // fake server call
  setTimeout(() => {
    // create a fake node
    const id = `${Date.now()}`
    const newNode = {
      text: `loaded from server`,
      children: [],
      state: {
        isLoading: false
      }
    }

    // add the node to nodes
    nodes[id] = newNode
    // set children
    n.children = [id]
    // end loading
    n.state.isLoading = false
  }, 2000)
}
</script>

<template>
  <v-card>
    <v-layout>
      <v-navigation-drawer>
        <v-list>
          <v-list-item title="Navigation drawer"></v-list-item>
        </v-list>
        <treeview :nodes="context.nodes" :config="context.config" @node-opened="addServerNode">
          <template #loading-slot>
            <div class="progress">
              <div class="indeterminate"></div>
            </div>
          </template>
        </treeview>
      </v-navigation-drawer>

      <v-app-bar title="Application bar"></v-app-bar>

      <v-main style="min-height: 300px">
        <v-container>
          <v-row>
            <v-col cols="12">
              <v-card>
                <v-card-title>Content</v-card-title>
              </v-card>
            </v-col>
          </v-row>
        </v-container>
      </v-main>
    </v-layout>
  </v-card>
</template>

<style lang="less">
@import './assets/css/styles.less';
</style>
