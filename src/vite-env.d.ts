// Vite virtual module declarations
declare module '*.css?url' {
  const url: string
  export default url
}

declare module '*.svg?url' {
  const url: string
  export default url
}
