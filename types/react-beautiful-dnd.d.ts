declare module "react-beautiful-dnd" {
  import * as React from "react"

  export type DraggableId = string
  export type DroppableId = string
  export type DragStart = {
    draggableId: DraggableId
    type: TypeId
    source: DraggableLocation
    mode: MovementMode
  }

  export type DragUpdate = DragStart & {
    destination?: DraggableLocation
    combine?: Combine
  }

  export type DropResult = {
    draggableId: DraggableId
    type: TypeId
    source: DraggableLocation
    destination?: DraggableLocation
    reason: DropReason
    mode: MovementMode
    combine?: Combine
  }

  export type DraggableLocation = {
    droppableId: DroppableId
    index: number
  }

  export type Combine = {
    draggableId: DraggableId
    droppableId: DroppableId
  }

  export type MovementMode = "FLUID" | "SNAP"
  export type DropReason = "DROP" | "CANCEL"
  export type TypeId = string

  export type DraggableRubric = {
    draggableId: DraggableId
    mode: MovementMode
    source: DraggableLocation
  }

  export type DroppableRubric = {
    droppableId: DroppableId
    type: TypeId
  }

  export type DraggableChildrenFn = (
    provided: DraggableProvided,
    snapshot: DraggableStateSnapshot,
    rubric: DraggableRubric,
  ) => React.ReactNode

  export type DroppableChildrenFn = (
    provided: DroppableProvided,
    snapshot: DroppableStateSnapshot,
    rubric: DroppableRubric,
  ) => React.ReactNode

  export type DraggableProvided = {
    innerRef: (element?: HTMLElement | null) => void
    draggableProps: DraggablePropsInner
    dragHandleProps: DragHandleProps | null
  }

  export type DraggablePropsInner = {
    style?: React.CSSProperties
    "data-rbd-draggable-context-id": string
    "data-rbd-draggable-id": string
    onTransitionEnd?: React.TransitionEventHandler
  }

  export type DragHandleProps = {
    "data-rbd-drag-handle-draggable-id": string
    "data-rbd-drag-handle-context-id": string
    role: string
    tabIndex: number
    "aria-grabbed": boolean
    draggable: boolean
    onDragStart: (event: React.DragEvent<HTMLElement>) => void
  }

  export type DroppableProvided = {
    innerRef: (element?: HTMLElement | null) => void
    droppableProps: DroppablePropsInner
    placeholder?: React.ReactNode
  }

  export type DroppablePropsInner = {
    "data-rbd-droppable-context-id": string
    "data-rbd-droppable-id": string
  }

  export type DraggableStateSnapshot = {
    isDragging: boolean
    isDropAnimating: boolean
    isClone: boolean
    dropAnimation?: DropAnimation
    draggingOver?: DroppableId
    combineWith?: DraggableId
    combineTargetFor?: DraggableId
    mode?: MovementMode
  }

  export type DropAnimation = {
    duration: number
    curve: string
    moveTo: Position
    opacity?: number
    scale?: number
  }

  export type DroppableStateSnapshot = {
    isDraggingOver: boolean
    draggingOverWith?: DraggableId
    draggingFromThisWith?: DraggableId
    isUsingPlaceholder: boolean
  }

  export type Position = {
    x: number
    y: number
  }

  export type DraggableProps = {
    draggableId: DraggableId
    index: number
    isDragDisabled?: boolean
    disableInteractiveElementBlocking?: boolean
    shouldRespectForcePress?: boolean
    children: DraggableChildrenFn
  }

  export type DroppableProps = {
    droppableId: DroppableId
    type?: TypeId
    mode?: DroppableMode
    isDropDisabled?: boolean
    isCombineEnabled?: boolean
    direction?: Direction
    ignoreContainerClipping?: boolean
    renderClone?: DraggableChildrenFn
    getContainerForClone?: () => HTMLElement
    children: DroppableChildrenFn
  }

  export type DroppableMode = "standard" | "virtual"
  export type Direction = "horizontal" | "vertical"

  export class Draggable extends React.Component<DraggableProps> {}
  export class Droppable extends React.Component<DroppableProps> {}
  export function resetServerContext(): void
  export function DragDropContext(props: any): React.JSX.Element
}
