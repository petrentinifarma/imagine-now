<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the health intake as one mobile-first guided question per screen; this protects readability for the 50+ audience.
- Store submitted intake records in Lovable Cloud while allowing no public read access; health responses are sensitive.
- Keep the sticky action bar a sibling of the animated screen section, never nested inside it; the fade-in animation leaves a transform on the section, which silently breaks position: sticky.
- Verify every screen against a 390x844 viewport before calling it done; content that falls below the fold is unreadable for this audience.
- Package prices live only in src/lib/plans.ts and charges are computed server-side from it; the browser never sends an amount.
- Asaas and Google Calendar are called only from *.server.ts helpers through the connector gateway; orders are confirmed by one confirmPayment used by both the webhook and the confirmation page poll.
