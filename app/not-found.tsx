import { LinkButton } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="shell flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
      <p className="eyebrow">Error 404</p>
      <h1 className="mt-4 text-3xl sm:text-4xl">This page never made it past review</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-mute-400">
        The link you followed doesn&apos;t exist — or the pitch behind it was withdrawn. Try the
        leaderboard or head back home.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LinkButton href="/">Back to home</LinkButton>
        <LinkButton href="/leaderboard" variant="secondary">
          View leaderboard
        </LinkButton>
      </div>
    </div>
  );
}
