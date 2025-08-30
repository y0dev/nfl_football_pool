# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - link "Back to main page" [ref=e6] [cursor=pointer]:
      - /url: /
      - img [ref=e7] [cursor=pointer]
      - generic [ref=e10] [cursor=pointer]: Back to main page
    - generic [ref=e11]:
      - generic [ref=e12]:
        - img [ref=e14]
        - heading "Commissioner Access" [level=3] [ref=e16]
        - paragraph [ref=e17]: Sign in to manage your NFL Confidence Pool
      - generic [ref=e19]:
        - generic [ref=e20]:
          - generic [ref=e21]: Email Address
          - textbox "Email Address" [ref=e22]
        - generic [ref=e23]:
          - generic [ref=e24]: Password
          - generic [ref=e25]:
            - textbox "Enter your password" [ref=e26]
            - button [ref=e27]:
              - img [ref=e28]
        - button "Sign In as Commissioner" [ref=e31]
    - paragraph [ref=e33]: Need help? Contact your pool commissioner
    - link "Create Commissioner Account" [ref=e36] [cursor=pointer]:
      - /url: /admin/register
  - button "Open Next.js Dev Tools" [ref=e42] [cursor=pointer]:
    - img [ref=e43] [cursor=pointer]
  - alert [ref=e47]
```