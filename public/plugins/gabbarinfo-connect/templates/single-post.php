<?php
/**
 * GabbarInfo Universal Single Post Template Fallback
 * 
 * Ensures that any WordPress site with a custom landing theme lacking single.php
 * renders full blog articles with complete content, featured image, and styling
 * without ever getting trapped in excerpt loops.
 */

get_header();
?>
<main id="primary" class="site-main gabbarinfo-article-container" style="min-height: 70vh; padding: 3rem 1rem;">
    <div class="container" style="max-width: 860px; margin: 0 auto;">
        <?php
        while ( have_posts() ) :
            the_post();
            ?>
            <article id="post-<?php the_ID(); ?>" <?php post_class( 'gabbarinfo-single-post' ); ?> style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 2.5rem; backdrop-filter: blur(10px);">
                <header class="entry-header" style="margin-bottom: 2.5rem; text-align: left;">
                    <div class="entry-meta" style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.75; margin-bottom: 0.75rem;">
                        <span>📅 <?php echo get_the_date(); ?></span> &bull; <span>✍️ <?php the_author(); ?></span>
                        <?php
                        $categories = get_the_category();
                        if ( ! empty( $categories ) ) {
                            echo ' &bull; <span>🏷️ ' . esc_html( $categories[0]->name ) . '</span>';
                        }
                        ?>
                    </div>

                    <h1 class="entry-title" style="font-size: clamp(1.85rem, 4vw, 2.75rem); line-height: 1.25; font-weight: 800; margin-bottom: 1.5rem;">
                        <?php the_title(); ?>
                    </h1>

                    <?php if ( has_post_thumbnail() ) : ?>
                        <div class="entry-thumbnail" style="margin-top: 1.5rem; margin-bottom: 2rem; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                            <?php the_post_thumbnail( 'large', array( 'style' => 'width: 100%; height: auto; display: block;' ) ); ?>
                        </div>
                    <?php endif; ?>
                </header>

                <div class="entry-content gabbarinfo-content" style="line-height: 1.85; font-size: 1.125rem; opacity: 0.95;">
                    <?php
                    the_content();

                    wp_link_pages( array(
                        'before' => '<div class="page-links" style="margin-top: 2rem;">' . esc_html__( 'Pages:', 'gabbarinfo' ),
                        'after'  => '</div>',
                    ) );
                    ?>
                </div>

                <footer class="entry-footer" style="margin-top: 3.5rem; padding-top: 1.75rem; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div class="post-tags" style="font-size: 0.9rem;">
                        <?php the_tags( '<strong>Tags:</strong> ', ', ', '' ); ?>
                    </div>
                    <div>
                        <a href="javascript:history.back()" style="display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 600; text-decoration: none; opacity: 0.85;">
                            &larr; Back to Articles
                        </a>
                    </div>
                </footer>
            </article>
            <?php
        endwhile;
        ?>
    </div>
</main>
<?php
get_footer();
