<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, defineProps, defineEmits } from 'vue'
import * as monaco from 'monaco-editor'

const props = defineProps<{
  modelValue: string
  language?: string
  fileName?: string
  height?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const editorContainer = ref<HTMLDivElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

function getLanguageFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const languageMap: Record<string, string> = {
    'sh': 'shell',
    'bash': 'shell',
    'py': 'python',
    'js': 'javascript',
    'ts': 'typescript',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'md': 'markdown',
    'txt': 'plaintext',
    'log': 'plaintext',
    'conf': 'properties',
    'config': 'properties',
    'sql': 'sql',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'php': 'php',
    'vue': 'vue',
    'svg': 'xml',
    'dockerfile': 'dockerfile',
    'gitignore': 'plaintext'
  }
  return languageMap[ext] || 'plaintext'
}

function createEditor() {
  if (!editorContainer.value) return
  
  const language = props.language || (props.fileName ? getLanguageFromFileName(props.fileName) : 'plaintext')
  
  editor = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language,
    theme: 'vs-dark',
    fontSize: 14,
    fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    minimap: {
      enabled: true
    },
    tabSize: 2,
    wordWrap: 'on',
    padding: {
      top: 16,
      bottom: 16
    },
    renderLineHighlight: 'line',
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
    folding: true,
    foldingHighlight: true,
    bracketPairColorization: {
      enabled: true
    },
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10
    },
    selectionHighlight: true,
    occurrencesHighlight: 'multiFile',
    find: {
      seedSearchStringFromSelection: 'always'
    }
  })

  editor.onDidChangeModelContent(() => {
    if (editor) {
      emit('update:modelValue', editor.getValue())
    }
  })
}

function disposeEditor() {
  if (editor) {
    editor.dispose()
    editor = null
  }
}

watch(() => props.modelValue, (newValue) => {
  if (editor && editor.getValue() !== newValue) {
    editor.setValue(newValue)
  }
})

watch(() => props.fileName, () => {
  disposeEditor()
  createEditor()
})

onMounted(() => {
  createEditor()
})

onUnmounted(() => {
  disposeEditor()
})
</script>

<template>
  <div ref="editorContainer" :style="{ height: height || '500px' }"></div>
</template>
