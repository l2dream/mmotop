<script setup lang="ts">
import type { SectionId } from '~/data/sections'
import { SECTION_SORTS, runsUp, type SortChoice, type SortKey } from '~/data/sorting'

/**
 * The orders a section page offers, one button each, under the panel's head.
 * The chosen one is pressed and carries an arrow for its direction; pressing
 * it again turns the order around (not the random one, which has Shuffle).
 */
const props = defineProps<{ section: SectionId, choice: SortChoice }>()
defineEmits<{ pick: [key: SortKey] }>()

const { t } = useI18n()
const up = computed(() => runsUp(props.section, props.choice))
const label = (key: SortKey) => key === props.choice.key && key !== 'random'
  ? `${t(`sort.${key}`)}, ${t(up.value ? 'sort.asc' : 'sort.desc')}`
  : t(`sort.${key}`)
</script>

<template>
  <div class="sort-bar" role="group" :aria-label="$t('sort.label')">
    <span class="sort-label" aria-hidden="true">{{ $t('sort.label') }}</span>
    <button
      v-for="key in SECTION_SORTS[section]"
      :key="key"
      type="button"
      class="sort-chip"
      :class="{ active: key === choice.key }"
      :aria-pressed="key === choice.key"
      :aria-label="label(key)"
      @click="$emit('pick', key)"
    >
      {{ $t(`sort.${key}`) }}
      <svg v-if="key === choice.key && key !== 'random'" class="sort-arrow" :class="{ up }" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 5v14" />
        <path d="M6 13l6 6 6-6" />
      </svg>
    </button>
  </div>
</template>
