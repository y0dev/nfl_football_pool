# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - link "Back" [ref=e6] [cursor=pointer]:
      - /url: /
      - img [ref=e7] [cursor=pointer]
      - generic [ref=e9] [cursor=pointer]: Back
    - generic [ref=e10]:
      - generic [ref=e11]:
        - img [ref=e13]
        - heading "Commissioner Access" [level=3] [ref=e15]
        - paragraph [ref=e16]: Sign in to manage your NFL Confidence Pool
      - generic [ref=e18]:
        - generic [ref=e19]:
          - generic [ref=e20]: Email Address
          - textbox "Email Address" [ref=e21]
        - generic [ref=e22]:
          - generic [ref=e23]: Password
          - generic [ref=e24]:
            - textbox "Enter your password" [ref=e25]
            - button [ref=e26]:
              - img [ref=e27]
        - button "Sign In as Commissioner" [ref=e30]
    - paragraph [ref=e32]: Need help? Contact your pool commissioner
    - link "Create Commissioner Account" [ref=e35] [cursor=pointer]:
      - /url: /admin/register
  - button "Open Next.js Dev Tools" [ref=e41] [cursor=pointer]:
    - img [ref=e42] [cursor=pointer]
  - alert [ref=e45]
```