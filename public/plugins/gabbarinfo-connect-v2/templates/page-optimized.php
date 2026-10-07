<?php
/**
 * GabbarInfo AI Dynamic Page Template
 * 
 * Ensures that pages optimized by GabbarInfo AI render their full, DOM-preserved
 * post_content from the WordPress database, while maintaining 100% compatibility
 * with the active theme's headers, footers, navigation, scripts, and typography.
 */

get_header();

// CRITICAL FIX: Disable wpautop for optimized raw HTML to prevent inserting <p> tags into flexbox/video heroes
remove_filter( 'the_content', 'wpautop' );

while ( have_posts() ) :
    the_post();
    $raw_content = get_the_content();
    // If raw content already contains its own root <main> tag, output directly without double wrapping
    if ( preg_match( '/<main\b/i', $raw_content ) ) {
        echo apply_filters( 'the_content', $raw_content );
    } else {
        echo '<main id="primary" class="site-main gabbarinfo-optimized-page-wrapper">';
        echo apply_filters( 'the_content', $raw_content );
        echo '</main>';
    }
endwhile;

get_footer();
