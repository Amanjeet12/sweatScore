import PostRow, { PostWithUser } from '~/components/core/posts/Row';

export default function FeaturedRow({ post }: { post: PostWithUser }) {
  return <PostRow post={post} isFeatured />;
}
