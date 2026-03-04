import tsParser from "@typescript-eslint/parser"

const APP_FEATURES = ["capture", "review", "library", "records", "search", "settings", "share"]
const FEATURE_LIB_DOMAINS = ["capture", "review", "settings", "content"]

const featureIsolationRules = APP_FEATURES.map((feature) => ({
  files: [`app/(features)/${feature}/**/*.{ts,tsx}`],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          ...APP_FEATURES.filter((name) => name !== feature).map((name) => ({
            group: [`@/app/(features)/${name}/*`],
            message: `Cross-feature UI import is not allowed. Use @shared/* or move shared code to app/(features)/_shared.`
          })),
          ...FEATURE_LIB_DOMAINS.filter((name) => name !== feature && name !== "content").map((name) => ({
            group: [`@feature-lib/${name}/*`],
            message: "Cross-feature lib import is not allowed. Only same-feature libs and @feature-lib/content/* are allowed."
          }))
        ]
      }
    ]
  }
}))

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "extension/**"
    ]
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/*"],
              message: "Use @shared/* or @app-shared/* (legacy components path is removed)."
            },
            {
              group: ["@/app/(features)/_shared/*"],
              message: "Use @shared/* alias instead of app path."
            },
            {
              group: ["@/app/_shared/*"],
              message: "Use @app-shared/* alias instead of app path."
            },
            {
              group: ["@/lib/features/*"],
              message: "Use @feature-lib/* alias instead of lib path."
            },
            {
              group: ["@/app/(features)/*/_components/*"],
              message: "Use relative imports for local feature _components to avoid cross-feature coupling."
            }
          ]
        }
      ]
    }
  },
  ...featureIsolationRules
]
