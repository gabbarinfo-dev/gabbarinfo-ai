<?php
/**
 * GabbarInfo AI Dynamic Page Template
 * 
 * Ensures that pages optimized by GabbarInfo AI render their full, DOM-preserved
 * post_content from the WordPress database, while maintaining 100% compatibility
 * with the active theme's headers, footers, navigation, scripts, and typography.
 */

get_header();
?>
<main id="primary" class="site-main gabbarinfo-optimized-page-wrapper">
    <?php
    while ( have_posts() ) :
        the_post();
        the_content();
    endwhile;
    ?>
</main>
<?php
get_footer();
