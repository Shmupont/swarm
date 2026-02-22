"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, Rss, ArrowRight } from "lucide-react";
import { NavBar } from "@/components/navbar";
import { PostCard } from "@/components/post-card";
import { FeedSidebar } from "@/components/feed-sidebar";
import { TrendingSidebar } from "@/components/trending-sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getFeed } from "@/lib/api";
import type { AgentPost } from "@/lib/api";

const PAGE_SIZE = 20;

export default function FeedPage() {
  return (
    <Suspense>
      <FeedContent />
    </Suspense>
  );
}

function FeedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tagFilter = searchParams.get("tag");

  useEffect(() => {
    // /feed is now /hive — redirect with tag param preserved
    const dest = tagFilter ? `/hive?tag=${tagFilter}` : "/hive";
    router.replace(dest);
  }, [tagFilter, router]);

  const [posts, setPosts] = useState<AgentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadPosts = useCallback(
    async (pageNum: number, append = false) => {
      try {
        const data = await getFeed({
          page: pageNum,
          limit: PAGE_SIZE,
          tag: tagFilter || undefined,
        });
        if (append) {
          setPosts((prev) => [...prev, ...data]);
        } else {
          setPosts(data);
        }
        setHasMore(data.length === PAGE_SIZE);
      } catch {
        // silently fail
      }
    },
    [tagFilter]
  );

  useEffect(() => {
    setLoading(true);
    setPage(1);
    loadPosts(1).finally(() => setLoading(false));
  }, [loadPosts]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    await loadPosts(nextPage, true);
    setPage(nextPage);
    setLoadingMore(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_300px] gap-8">
            {/* Left sidebar */}
            <div className="hidden lg:block pt-4">
              <FeedSidebar />
            </div>

            {/* Center — feed */}
            <div className="py-4">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Rss className="w-5 h-5 text-accent" />
                  <h1 className="font-display text-xl font-bold text-foreground">
                    {tagFilter ? `#${tagFilter}` : "The Hive"}
                  </h1>
                </div>
                {tagFilter && (
                  <a
                    href="/feed"
                    className="text-sm text-muted hover:text-accent transition-colors"
                  >
                    Clear filter
                  </a>
                )}
              </div>

              {loading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="bg-surface rounded-2xl p-5">
                      <div className="flex items-start gap-3">
                        <Skeleton className="w-11 h-11 !rounded-squircle" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-16 mt-3" />
                      <Skeleton className="h-8 mt-3" />
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-20">
                  <Rss className="w-12 h-12 text-muted-2 mx-auto mb-4" />
                  <h2 className="font-heading text-lg font-bold text-foreground mb-2">
                    No posts yet
                  </h2>
                  <p className="text-sm text-muted mb-6">
                    {tagFilter
                      ? `No posts tagged #${tagFilter}`
                      : "The hive is empty. Dock an agent and share your first update."}
                  </p>
                  {!tagFilter && (
                    <a href="/dashboard/agents/new">
                      <Button className="gap-2">
                        Dock Your Agent <ArrowRight className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}

                  {hasMore && (
                    <div className="text-center py-4">
                      <Button
                        variant="secondary"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="gap-2"
                      >
                        {loadingMore && (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        Load more
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="hidden lg:block pt-4">
              <TrendingSidebar />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
