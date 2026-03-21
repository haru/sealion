"use client";

import { Card, CardContent, Box, Skeleton } from "@mui/material";

interface TodoListSkeletonProps {
  count?: number;
}

/** Renders placeholder skeleton cards while the issue list is loading. */
export default function TodoListSkeleton({ count = 5 }: TodoListSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} variant="outlined" sx={{ mb: 1 }}>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
              <Skeleton variant="rectangular" width={24} height={24} sx={{ mt: 0.5 }} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="70%" />
                <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                  <Skeleton variant="rounded" width={60} height={24} />
                  <Skeleton variant="rounded" width={100} height={24} />
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
