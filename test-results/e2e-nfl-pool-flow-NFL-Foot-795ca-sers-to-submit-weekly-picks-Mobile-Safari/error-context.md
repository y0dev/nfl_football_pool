# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - heading "Error" [level=3] [ref=e6]
      - paragraph [ref=e7]: Failed to load pool information. Please try again or contact the pool commissioner.
    - generic [ref=e8]:
      - generic [ref=e9]:
        - button "Retry" [ref=e10]:
          - img [ref=e11]
          - text: Retry
        - link "Back to Home" [ref=e16]:
          - /url: /
          - button "Back to Home" [ref=e17]:
            - img [ref=e18]
            - text: Back to Home
      - generic [ref=e20]:
        - paragraph [ref=e21]:
          - strong [ref=e22]: "Debug Info:"
        - paragraph [ref=e23]: "Pool ID: test-pool-id"
        - paragraph [ref=e24]: "Week: undefined"
        - paragraph [ref=e25]: "Season Type: undefined"
  - button "Open Next.js Dev Tools" [ref=e31] [cursor=pointer]:
    - img [ref=e32] [cursor=pointer]
  - alert [ref=e37]
```