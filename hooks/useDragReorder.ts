'use client';

import { useState } from 'react';
import type { DragEvent } from 'react';

// Native HTML5 drag-and-drop (no library) for reordering a list of items
// rendered in a fixed order. The consumer owns the array and persistence --
// this hook only tracks which index is being dragged / dragged over, and
// calls back with (fromIndex, toIndex) on drop so the caller can splice its
// own array and persist however it needs to (a single batch "here's the new
// order" write, not incremental swaps -- a drag can jump more than one
// position, unlike the existing up/down arrow buttons).
export function useDragReorder(onReorder: (fromIndex: number, toIndex: number) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function dragHandleProps(index: number) {
    return {
      draggable: true,
      onDragStart: (e: DragEvent) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        // Firefox requires data to be set for drag to actually start.
        e.dataTransfer.setData('text/plain', String(index));
      },
      onDragEnd: () => {
        setDragIndex(null);
        setOverIndex(null);
      }
    };
  }

  function dropTargetProps(index: number) {
    return {
      onDragOver: (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragIndex !== null && index !== overIndex) setOverIndex(index);
      },
      onDragLeave: () => {
        setOverIndex((cur) => (cur === index ? null : cur));
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index);
        setDragIndex(null);
        setOverIndex(null);
      }
    };
  }

  return { dragHandleProps, dropTargetProps, dragIndex, overIndex };
}

/** Move the item at `from` to sit at `to`, shifting everything between. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
