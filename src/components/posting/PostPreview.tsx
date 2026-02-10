import { Property, FacebookGroup } from '@/types/property';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Globe, ThumbsUp, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import { mockUser } from '@/data/mockData';

interface PostPreviewProps {
  property: Property;
  caption: string;
  group?: FacebookGroup;
}

export function PostPreview({ property, caption, group }: PostPreviewProps) {
  return (
    <Card className="card-elevated overflow-hidden max-w-[500px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          <span>Facebook Post Preview</span>
          {group && (
            <Badge variant="outline">{group.name}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Facebook-style post */}
        <div className="bg-card border rounded-lg m-4 mt-0 overflow-hidden">
          {/* Post Header */}
          <div className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {mockUser.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">{mockUser.name}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>Just now</span>
                  <span>·</span>
                  <Globe className="w-3 h-3" />
                </div>
              </div>
            </div>
            <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
          </div>

          {/* Post Content */}
          <div className="px-3 pb-3">
            <p className="text-sm whitespace-pre-wrap">{caption || 'Your caption will appear here...'}</p>
          </div>

          {/* Post Images */}
          {property.images.length > 0 && (
            <div className="relative">
              {property.images.length === 1 ? (
                <img
                  src={property.images[0]}
                  alt="Property"
                  className="w-full aspect-[4/3] object-cover"
                />
              ) : property.images.length === 2 ? (
                <div className="grid grid-cols-2 gap-0.5">
                  {property.images.slice(0, 2).map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`Property ${i + 1}`}
                      className="w-full aspect-square object-cover"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-0.5">
                  <img
                    src={property.images[0]}
                    alt="Property 1"
                    className="w-full aspect-square object-cover row-span-2"
                  />
                  <img
                    src={property.images[1]}
                    alt="Property 2"
                    className="w-full aspect-[2/1] object-cover"
                  />
                  <div className="relative">
                    <img
                      src={property.images[2]}
                      alt="Property 3"
                      className="w-full aspect-[2/1] object-cover"
                    />
                    {property.images.length > 3 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white text-2xl font-bold">
                          +{property.images.length - 3}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reactions Bar */}
          <div className="px-3 py-2 border-t flex items-center justify-between text-muted-foreground text-sm">
            <span>0 reactions</span>
            <span>0 comments · 0 shares</span>
          </div>

          {/* Action Buttons */}
          <div className="px-3 py-1 border-t flex items-center justify-around">
            <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-md transition-colors flex-1 justify-center">
              <ThumbsUp className="w-5 h-5" />
              <span className="text-sm font-medium">Like</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-md transition-colors flex-1 justify-center">
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Comment</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-md transition-colors flex-1 justify-center">
              <Share2 className="w-5 h-5" />
              <span className="text-sm font-medium">Share</span>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
