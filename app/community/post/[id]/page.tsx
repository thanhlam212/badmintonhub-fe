import { PostDetail } from '@/components/community/post-detail'

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PostDetail id={id} />
}
