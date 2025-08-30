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
        - link "Back to Home" [ref=e16] [cursor=pointer]:
          - /url: /
          - button "Back to Home" [ref=e17]:
            - img [ref=e18]
            - text: Back to Home
      - generic [ref=e21]:
        - paragraph [ref=e22]:
          - strong [ref=e23]: "Debug Info:"
        - paragraph [ref=e24]: "Pool ID: test-pool-id"
        - paragraph [ref=e25]: "Week: undefined"
        - paragraph [ref=e26]: "Season Type: undefined"
  - button "Open Next.js Dev Tools" [ref=e32] [cursor=pointer]:
    - img [ref=e33] [cursor=pointer]
  - alert [ref=e37]
```